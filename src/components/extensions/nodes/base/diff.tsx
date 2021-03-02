import {
  Fragment,
  Mark,
  Node as ProsemirrorNode,
  NodeType,
  ResolvedPos,
  Slice,
} from "prosemirror-model";
import { Transaction } from "prosemirror-state";
import lcs from "diff-sequences";

import { dmp } from "../../../editor";

// when f returns true, the nodes iterating aborts
function nodesBetween(
  node: ProsemirrorNode | Fragment,
  from: number,
  to: number,
  f: (node: ProsemirrorNode, pos: number, parent: number) => boolean | void,
  nodeStart = 0,
  parent = -1
) {
  for (let i = 0, pos = 0; pos < to; i++) {
    const child = node.child(i);
    const end = pos + child.nodeSize;
    if (end > from) {
      if (f(child, nodeStart + pos, parent)) {
        return true;
      }

      if (child.content.size) {
        const start = pos + 1;
        if (
          nodesBetween(
            child,
            Math.max(0, from - start),
            Math.min(child.content.size, to - start),
            f,
            nodeStart + start,
            nodeStart + pos
          )
        ) {
          return true;
        }
      }
    }

    pos = end;
  }
}

class Match {
  readonly from = new Map<number, number>();
  readonly to = new Map<number, number>();

  private readonly pairs: number[] = [];

  constructor(t1: Tree, t2: Tree) {
    const unmatched1 = new Set<number>();
    const unmatched2 = new Set<number>();

    t1.postOrder((i) => unmatched1.add(i));
    t2.postOrder((i) => unmatched2.add(i));

    for (const from of unmatched1) {
      const $from = t1.nodes[from];
      for (const to of unmatched2) {
        const $to = t2.nodes[to];
        if ($from.equal($to, this)) {
          unmatched2.delete(to);
          this.add(from, to);
          break;
        }
      }
    }
  }

  add(x: number, y: number) {
    this.from.set(x, y);
    this.to.set(y, x);
    this.pairs.push(x, y);
    return this;
  }

  has(x: number, y: number) {
    return this.from.get(x) === y;
  }

  each(f: (x: number, y: number) => void) {
    for (let i = 0; i < this.pairs.length; i += 2) {
      f(this.pairs[i], this.pairs[i + 1]);
    }
  }
}

type MOV = {
  type: 1;
  from: number;
  parent: number;
  index: number;
};

type INS = {
  type: 2;
  from: number;
  parent: number;
  index: number;
  to: number;
};

type UPD = {
  type: 3;
  from: number;
  to: number;
};

type DEL = {
  type: 4;
  from: number;
};

type OP = MOV | INS | UPD | DEL;

class Order {
  readonly from = new Set<number>();
  readonly to = new Set<number>();

  mark(x: number, y: number) {
    this.from.add(x);
    this.to.add(y);
  }
}

class Node {
  constructor(
    readonly tree: Tree,
    readonly id: number,
    readonly node: ProsemirrorNode,
    readonly parent: number,
    readonly depth: number,
    readonly children: number[] = [],
    readonly leaves: Set<number> = new Set()
  ) {}

  equal(other: Node, matched: Match) {
    const { node: n1, leaves: l1 } = this;
    const { node: n2, leaves: l2 } = other;

    if (n1.type !== n2.type) {
      return false;
    }

    // internal nodes
    if (l1.size && l2.size) {
      let common = 0;
      matched.each((x, y) => {
        if (l1.has(x) && l2.has(y)) {
          ++common;
        }
      });
      return common / Math.max(l1.size, l2.size) > 0.5;
    }

    // leaf nodes
    if (!l1.size && !l2.size && n1.sameMarkup(n2)) {
      if (!n1.isText || !n1.text || !n2.text) {
        return true;
      }

      return (
        dmp
          .diff_main(n1.text, n2.text)
          .reduce((sum, [op]) => sum + Math.abs(op), 0) < 2
      );
    }

    return false;
  }
}

class Tree {
  readonly breadth: number[][] = [];
  readonly nodes: Record<number, Node> = {};

  constructor(readonly root: ProsemirrorNode) {
    this.breadth[0] = [0];
    this.nodes[0] = new Node(this, 0, root, -1, 0);
    // the dummy root(-1) always match with another tree's
    this.nodes[-1] = new Node(this, -1, null as any, -1, -1, [0]);

    nodesBetween(
      root.content,
      0,
      root.content.size,
      (node, id, parent) => {
        const p = this.nodes[parent];
        const depth = p.depth + 1;
        if (!this.breadth[depth]) {
          this.breadth[depth] = [id];
        } else {
          this.breadth[depth].push(id);
        }

        p.children.push(id);
        if (!node.content.size) {
          // this is a leaf
          p.leaves.add(id);
        }

        this.nodes[id] = new Node(this, id, node, parent, depth, []);
      },
      1,
      0
    );

    this.postOrder((i) => {
      const n = this.nodes[i];
      const p = this.nodes[n.parent];
      n.leaves.forEach((i) => p.leaves.add(i));
    });
  }

  bfs(f: (id: number) => void) {
    this.breadth.forEach((x) => x.forEach(f));
  }

  postOrder(f: (id: number) => void, id = 0) {
    for (const child of this.nodes[id].children) {
      this.postOrder(f, child);
    }
    f(id);
  }
}

class Diff {
  readonly ops: OP[] = [];
  readonly ordered = new Order();
  readonly matched: Match;
  readonly from: Tree;
  readonly to: Tree;

  constructor(a: ProsemirrorNode, b: ProsemirrorNode) {
    this.from = new Tree(a);
    this.to = new Tree(b);

    // add match of dummy roots
    this.matched = new Match(this.from, this.to).add(-1, -1);
    if (!this.good()) {
      return;
    }

    let counter = a.nodeSize;
    this.to.bfs((to) => {
      const $to = this.to.nodes[to];
      const from = this.matched.to.get(to);
      if (from === undefined) {
        this.insertPhase(counter++, $to);
      } else {
        const $from = this.from.nodes[from];
        this.updatePhase($from, $to);
        this.movePhase($from, $to);
      }
    });

    this.deletePhase();
  }

  good() {
    return this.matched.has(0, 0);
  }

  patch(tr: Transaction) {
    this.ops.forEach((op) => {
      switch (op.type) {
        case 1: // move
          break;
        case 2: // insert
          break;
        case 3: // update
          break;
        case 4: // delete
          break;
      }
    });
    return tr;
  }

  private insertPhase(from: number, $to: Node) {
    const { parent, id: to } = $to;
    const $px = this.from.nodes[this.matched.to.get(parent)!];
    const index = this.findPos($px, $to.tree.nodes[parent], to);
    $px.children.splice(index, 0, from);
    this.from.nodes[from] = new Node(
      this.from,
      from,
      null as any,
      $px.id,
      $px.depth + 1
    );

    this.matched.add(from, to);
    this.ordered.mark(from, to);
    this.insert(from, $px.id, index, to);
  }

  private updatePhase($from: Node, $to: Node) {
    if (!$from.node.sameMarkup($to.node) || $from.node.text !== $to.node.text) {
      this.update($from.id, $to.id);
    }
  }

  private movePhase($from: Node, $to: Node) {
    if (!this.matched.has($from.parent, $to.parent)) {
      const from = $from.id;
      const to = $to.id;
      const $px = $from.tree.nodes[this.matched.to.get($to.parent)!];
      const $py = $to.tree.nodes[$to.parent];
      const index = this.findPos($px, $py, to);
      $px.children.splice(index, 0, from);

      // cleanup in old parent
      const $p = $from.tree.nodes[$from.parent];
      const i = $p.children.indexOf(from);
      if (i === -1) {
        throw new Error(`Not found index of ${from}`);
      }
      $p.children.splice(i, 1);

      this.move(from, $px.id, index);
      this.ordered.mark(from, to);
    }

    this.alignChildren($from, $to);
  }

  private deletePhase() {
    this.from.postOrder((from) => {
      if (!this.matched.from.has(from)) {
        this.delete(from);
      }
    });
  }

  private move(from: number, parent: number, index: number) {
    this.ops.push({ type: 1, from, parent, index });
  }

  private insert(from: number, parent: number, index: number, to: number) {
    this.ops.push({ type: 2, from, parent, index, to });
  }

  private update(from: number, to: number) {
    this.ops.push({ type: 3, from, to });
  }

  private delete(from: number) {
    this.ops.push({ type: 4, from });
  }

  private alignChildren($from: Node, $to: Node) {
    const { matched, ordered } = this;

    const s1 = $from.children.filter((from) => {
      const to = matched.from.get(from);
      return to && $to.tree.nodes[to].parent === $to.id;
    });

    const s2 = $to.children.filter((to) => {
      const from = matched.to.get(to);
      return from && $from.tree.nodes[from].parent === $from.id;
    });

    lcs(
      s1.length,
      s2.length,
      (i, j) => matched.has(s1[i], s2[j]),
      (n, i, j) => {
        for (; n !== 0; n--, i++, j++) {
          ordered.mark(s1[i], s2[j]);
        }
      }
    );

    for (const c1 of s1) {
      const c2 = s2.find((c2) => !ordered.to.has(c2) && matched.has(c1, c2));
      if (c2) {
        this.move(c1, $from.id, this.findPos($from, $to, c2));
        ordered.mark(c1, c2);
      }
    }
  }

  private findPos($px: Node, $py: Node, y: number) {
    const { matched, ordered } = this;

    // find the last sibling before the child that is in order
    let lastY: number | undefined;
    for (const id of $py.children) {
      if (id === y) {
        break;
      }
      if (ordered.to.has(id)) {
        lastY = id;
      }
    }

    if (lastY === undefined) {
      return 0;
    }

    let i = 0;
    const lastX = matched.to.get(lastY)!;
    for (const id of $px.children) {
      if (id === lastX) {
        break;
      }
      if (ordered.from.has(id)) {
        ++i;
      }
    }

    return i + 1;
  }
}

export default function diff(from: ProsemirrorNode, to: ProsemirrorNode) {
  return new Diff(from, to);
}
