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
import sortedIndex from "lodash.sortedindex";

// when f returns true, the nodes iterating aborts
function nodesBetween(
  node: ProsemirrorNode | Fragment,
  from: number,
  to: number,
  f: (
    node: ProsemirrorNode,
    pos: number,
    parent: number,
    index: number
  ) => boolean | void,
  nodeStart = 0,
  parent = -1
) {
  for (let i = 0, pos = 0; pos < to; i++) {
    const child = node.child(i);
    const end = pos + child.nodeSize;
    if (end > from) {
      if (f(child, nodeStart + pos, parent, i)) {
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

function binarySearch(array: number[], value: number) {
  const i = sortedIndex(array, value);
  return array[i] === value ? i : -1;
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
  depth: number;
};

type INS = {
  type: 2;
  from: number;
  parent: number;
  index: number;
  depth: number;
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
  delta?: ReturnType<typeof dmp["diff_main"]>;

  constructor(
    readonly tree: Tree,
    readonly id: number,
    readonly node: ProsemirrorNode,
    readonly parent: number,
    readonly index: number,
    readonly depth: number,
    readonly children: number[] = [] // the content will be following the diff process
  ) {}

  equal(other: Node, matched: Match) {
    const { node: n1 } = this;
    const { node: n2 } = other;

    if (n1.type !== n2.type) {
      return false;
    }

    const size1 = this.leavesSize();
    const size2 = other.leavesSize();

    // internal nodes
    if (size1 && size2) {
      let common = 0;
      matched.each((x, y) => {
        if (this.containsLeaf(x) && other.containsLeaf(y)) {
          ++common;
        }
      });
      return common / Math.max(size1, size2) > 0.5;
    }

    // leaf nodes
    if (!size1 && !size2 && n1.sameMarkup(n2)) {
      if (!n1.isText || !n1.text || !n2.text) {
        return true;
      }

      const delta = dmp.diff_main(n1.text, n2.text);
      if (delta.reduce((sum, [op]) => sum + Math.abs(op), 0) < 2) {
        this.delta = delta;
        return true;
      }
    }

    return false;
  }

  containsLeaf(id: number) {
    return (
      this.id < id &&
      id < this.id + this.node.nodeSize &&
      binarySearch(this.tree.leaves, id) !== -1
    );
  }

  leavesSize() {
    const leaves = this.tree.leaves;
    const lowerBound = sortedIndex(leaves, this.id);
    if (leaves[lowerBound] === this.id) {
      // the node itself is a leaf
      return 0;
    }
    const upperBound = sortedIndex(leaves, this.id + this.node.nodeSize);
    return upperBound - lowerBound;
  }

  isLeaf() {
    // this examination might not be as precise as node.isLeaf
    return !this.node.content.size;
  }
}

class Tree {
  readonly breadth: number[][] = [];
  readonly nodes: Record<number, Node> = {};
  readonly leaves: number[] = []; // a sorted array

  constructor(readonly root: ProsemirrorNode) {
    this.breadth[0] = [0];
    this.nodes[0] = new Node(
      this,
      0,
      root,
      -1 /* parent */,
      0 /* index */,
      0 /* depth */
    );
    // the dummy root(-1) always match with another tree's
    this.nodes[-1] = new Node(
      this,
      -1,
      null as any,
      -1 /* parent */,
      0 /* index */,
      -1 /* depth */,
      [0]
    );

    nodesBetween(
      root.content,
      0,
      root.content.size,
      (node, id, parent, index) => {
        const p = this.nodes[parent];
        const depth = p.depth + 1;
        if (!this.breadth[depth]) {
          this.breadth[depth] = [id];
        } else {
          this.breadth[depth].push(id);
        }

        p.children.push(id);
        const $node = new Node(this, id, node, parent, index, depth);
        if ($node.isLeaf()) {
          this.leaves.push(id);
        }
        this.nodes[id] = $node;
      },
      1,
      0
    );
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

export class Diff {
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

  patch(tr: Transaction, start = 0) {
    const getUpdPos = ({ from }: OP) => tr.mapping.map(from + start);
    const getInsPos = ({ parent, index }: Pick<INS, "parent" | "index">) => {
      const $node = tr.doc.resolve(
        parent >= this.from.root.nodeSize
          ? getInsPos(this.from.nodes[parent])
          : tr.mapping.map(parent + start)
      );

      let pos = $node.start();
      const node = $node.parent;
      for (let i = 0; i < node.childCount && i !== index; ++i) {
        pos += node.child(i).nodeSize;
      }

      ++pos;
      return pos;
    };

    this.ops.forEach((op) => {
      switch (op.type) {
        case 1: {
          // move
          const pos = getUpdPos(op) - 1;
          const { node, id } = this.from.nodes[op.from];
          if (!this.willBeDeleted(id)) {
            tr.delete(pos, pos + node.nodeSize);
            // TODO: mapping doesn't work after deletion
          }
          tr.insert(getInsPos(op) - 1, node);
          break;
        }
        case 2: {
          // insert
          const pos = getInsPos(op);
          const { node } = this.to.nodes[op.to];
          tr.insert(pos - 1, node.isInline ? node : node.copy());
          break;
        }
        case 3: {
          // update
          const pos = getUpdPos(op);
          const { delta } = this.from.nodes[op.from];
          if (delta) {
            let i = pos - 1;
            delta.forEach(([code, text]) => {
              if (code === 0) {
                i += text.length;
              } else if (code < 0) {
                tr.delete(i, i + text.length);
              } else {
                tr.insertText(text, i);
                i += text.length;
              }
            });
          } else {
            const { node } = this.to.nodes[op.to];
            tr.setNodeMarkup(pos, node.type, node.attrs, node.marks);
          }
          break;
        }
        case 4: {
          // delete
          const pos = getUpdPos(op);
          const { node } = this.from.nodes[op.from];
          tr.delete(
            pos - 1,
            node.isInline
              ? pos - 1 + node.nodeSize
              : tr.doc.resolve(pos).after()
          );
          break;
        }
      }
    });

    return tr;
  }

  private willBeDeleted(id: number) {
    for (let i = this.ops.length - 1; i >= 0; --i) {
      if (this.ops[i].type !== 4) {
        break;
      }
      const $del = this.from.nodes[this.ops[i].from];
      if ($del.id <= id && id < $del.id + $del.node.nodeSize) {
        return true;
      }
    }
    return false;
  }

  private insertPhase(from: number, $to: Node) {
    const { parent, id: to } = $to;
    const $px = this.from.nodes[this.matched.to.get(parent)!];
    const index = this.findIndex($px, $to.tree.nodes[parent], to);
    $px.children.splice(index, 0, from);
    const $from = (this.from.nodes[from] = new Node(
      this.from,
      from,
      null as any,
      $px.id,
      index,
      $px.depth + 1
    ));

    this.ops.push({
      type: 2,
      from,
      to,
      index,
      parent: $from.parent,
      depth: $from.depth,
    });
    this.matched.add(from, to);
    this.ordered.mark(from, to);
  }

  private updatePhase($from: Node, $to: Node) {
    if (!$from.node.sameMarkup($to.node) || $from.node.text !== $to.node.text) {
      this.ops.push({ type: 3, from: $from.id, to: $to.id });
    }
  }

  private movePhase($from: Node, $to: Node) {
    if (!this.matched.has($from.parent, $to.parent)) {
      const from = $from.id;
      const to = $to.id;
      const $px = $from.tree.nodes[this.matched.to.get($to.parent)!];
      const $py = $to.tree.nodes[$to.parent];
      const index = this.findIndex($px, $py, to);
      $px.children.splice(index, 0, from);

      // cleanup in old parent
      const $p = $from.tree.nodes[$from.parent];
      const i = $p.children.indexOf(from);
      if (i === -1) {
        throw new Error(`Not found index of ${from}`);
      }
      $p.children.splice(i, 1);

      this.ops.push({
        type: 1,
        from,
        index,
        parent: $px.id,
        depth: $px.depth + 1,
      });
      this.ordered.mark(from, to);
    }

    this.alignChildren($from, $to);
  }

  private deletePhase() {
    const i = this.ops.length;
    this.from.postOrder((from) => {
      if (!this.matched.from.has(from)) {
        // merge leaves deletion into sub-tree deletion
        let j = this.ops.length;
        while (j > i && this.from.nodes[this.ops[j - 1].from].parent === from) {
          --j;
        }
        this.ops.splice(j, Infinity, { type: 4, from });
      }
    });
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
        this.ops.push({
          type: 1,
          from: c1,
          index: this.findIndex($from, $to, c2),
          parent: $from.id,
          depth: $from.depth + 1,
        });
        ordered.mark(c1, c2);
      }
    }
  }

  private findIndex($px: Node, $py: Node, y: number) {
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
