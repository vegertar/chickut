import { Fragment, Node as ProsemirrorNode, Schema } from "prosemirror-model";
import { Transaction } from "prosemirror-state";
import lcs from "diff-sequences";
import sortedIndex from "lodash.sortedindex";
import sortedIndexBy from "lodash.sortedindexby";

import { dmp } from "../../../editor";

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

// TODO: not satisify acyclic criteria yet
class Match {
  readonly from = new Map<number, number>();
  readonly to = new Map<number, number>();

  private readonly pairs: number[] = [];

  constructor(t1: Tree, t2: Tree) {
    const unmatched1 = new Set<number>();
    const unmatched2 = new Set<number>();
    const acyclic = new Map<number, number[]>();

    t1.postOrder((i) => unmatched1.add(i));
    t2.postOrder((i) => unmatched2.add(i));

    for (const from of unmatched1) {
      const $from = t1.nodes[from];
      for (const to of unmatched2) {
        const $to = t2.nodes[to];
        const similary = $from.compare($to, this);
        if (!similary) {
          continue;
        }

        const branches = acyclic.get(from);
        const hasCycles = branches?.some((x) => $to.contains(x));
        if (hasCycles) {
          continue;
        }

        if (similary > 0.5) {
          unmatched2.delete(to);
          acyclic.delete(from);
          this.add(from, to);
          break;
        }

        if (branches) {
          branches.push(to);
        } else {
          acyclic.set(from, [to]);
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
  tree?: boolean;
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

    if (!this.isLeaf()) {
      if (!n1.content.size && !n2.content.size) {
        return true;
      }
      let common = 0;
      matched.each((x, y) => {
        if (this.containsLeaf(x) && other.containsLeaf(y)) {
          ++common;
        }
      });
      return common / Math.max(this.leavesSize(), other.leavesSize()) > 0.5;
    } else if (n1.sameMarkup(n2)) {
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

  compare(other: Node, matched: Match) {
    const { node: n1 } = this;
    const { node: n2 } = other;

    if (n1.type !== n2.type) {
      // TODO: content might be compatible
      return 0; // completely different
    }

    if (!this.isLeaf()) {
      if (!n1.content.size && !n2.content.size) {
        return 1; // completely the same
      }

      let common = 0;
      matched.each((x, y) => {
        if (this.containsLeaf(x) && other.containsLeaf(y)) {
          ++common;
        }
      });
      return common / Math.max(this.leavesSize(), other.leavesSize());
    }

    if (n1.sameMarkup(n2)) {
      if (!n1.isText || !n1.text || !n2.text) {
        return 1;
      }

      const delta = dmp.diff_main(n1.text, n2.text);
      const cost = delta.reduce((sum, [op]) => sum + Math.abs(op), 0);
      const similarity = cost ? 1 / cost : 1;
      if (similarity > 0.5) {
        this.delta = delta;
      }
      return similarity;
    }

    return 0.000001; // treated as 1 common leaf in 1e6 ones
  }

  containsLeaf(id: number) {
    return this.contains(id) && binarySearch(this.tree.leaves, id) !== -1;
  }

  contains(id: number) {
    return this.id < id && id < this.id + this.node.nodeSize;
  }

  leavesSize() {
    if (this.isLeaf()) {
      return 0;
    }
    const leaves = this.tree.leaves;
    const lowerBound = sortedIndex(leaves, this.id);
    const upperBound = sortedIndex(leaves, this.id + this.node.nodeSize);
    return upperBound - lowerBound;
  }

  isLeaf() {
    return this.node.isLeaf;
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
        const $parent = this.nodes[parent];
        const depth = $parent.depth + 1;
        if (!this.breadth[depth]) {
          this.breadth[depth] = [id];
        } else {
          this.breadth[depth].push(id);
        }

        $parent.children.push(id);
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

  contains(id: number) {
    return id >= 0 && id < this.root.nodeSize;
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

class Patch {
  private readonly moved: MOV[] = [];

  constructor(
    readonly diff: { from: Tree; to: Tree; ops: OP[] },
    readonly tr: Transaction,
    readonly start = 0
  ) {}

  private getPos(id: number) {
    const nodes = this.diff.from.nodes;
    const $node = nodes[id];
    const parent = $node.parent;
    if (parent === -1) {
      return this.start;
    }

    if (!this.diff.from.contains(id)) {
      // new inserted node
      return this.getChildPos(parent, $node.index);
    }

    if (this.moved.length) {
      const i = sortedIndexBy<Pick<OP, "from">>(
        this.moved,
        { from: id },
        "from"
      );

      if (i < this.moved.length) {
        const $moved = this.moved[i];
        if ($moved.from === id) {
          // just is the moved one, finding through MOV
          return this.getChildPos($moved.parent, $moved.index);
        }
      }

      if (i > 0 && nodes[this.moved[i - 1].from].contains(id)) {
        // under a moved ancestor, finding by its parent
        return this.getChildPos(parent, $node.index);
      }
    }

    return this.tr.mapping.map(id);
  }

  private getChildPos(parent: number, index: number) {
    if (parent === -1) {
      return this.start;
    }

    const $node = this.tr.doc.resolve(this.getPos(parent));

    let pos = $node.start();
    const node = $node.parent;
    for (let i = 0; i < node.childCount && i !== index; ++i) {
      pos += node.child(i).nodeSize;
    }
    return pos + 1;
  }

  private willBeDeleted(id: number) {
    const ops = this.diff.ops;
    const nodes = this.diff.from.nodes;

    for (let i = ops.length - 1; i >= 0; --i) {
      if (ops[i].type !== 4) {
        break;
      }
      const $del = nodes[ops[i].from];
      if ($del.id === id || $del.contains(id)) {
        return true;
      }
    }
    return false;
  }

  move(op: MOV) {
    const pos = this.getPos(op.from);
    const $from = this.diff.from.nodes[op.from];
    const $pos = this.tr.doc.resolve(pos);

    let start = pos - 1;
    let node = $pos.parent;
    if ($from.node.isText) {
      if ($pos.textOffset === 0) {
        // the text node has been removed heading content
        start = pos;
      }

      node = node.child($pos.index());
    }

    if (!this.willBeDeleted(op.from)) {
      this.tr.delete(start, start + node.nodeSize);
    }

    this.moved.push(op);
    this.moved.sort((a, b) => a.from - b.from);
    this.tr.insert(this.getChildPos(op.parent, op.index) - 1, node);
  }

  insert(op: INS) {
    const pos = this.getChildPos(op.parent, op.index);
    const { node } = this.diff.to.nodes[op.to];
    this.tr.insert(pos - 1, op.tree || node.isInline ? node : node.copy());
  }

  private updateText(pos: number, delta: NonNullable<Node["delta"]>) {
    const $pos = this.tr.doc.resolve(pos);
    const schema = this.tr.doc.type.schema as Schema;
    const marks = $pos.parent.child($pos.index()).marks;

    delta.forEach(([code, text]) => {
      if (code === 0) {
        pos += text.length;
      } else if (code < 0) {
        this.tr.delete(pos, pos + text.length);
      } else {
        this.tr.replaceRangeWith(pos, pos, schema.text(text, marks));
        pos += text.length;
      }
    });
  }

  update(op: UPD) {
    const pos = this.getPos(op.from) - 1;
    const { delta } = this.diff.from.nodes[op.from];
    if (delta) {
      this.updateText(pos, delta);
    } else {
      const { node } = this.diff.to.nodes[op.to];
      this.tr.setNodeMarkup(pos, node.type, node.attrs, node.marks);
    }
  }

  delete(op: DEL) {
    const pos = this.getPos(op.from);
    const { node } = this.diff.from.nodes[op.from];
    this.tr.delete(
      pos - 1,
      node.isText ? pos - 1 + node.nodeSize : this.tr.doc.resolve(pos).after()
    );
  }
}

export class LaDiff {
  readonly ops: OP[] = [];
  readonly ordered = new Order();
  readonly matched: Match;
  readonly from: Tree;
  readonly to: Tree;
  readonly good: boolean;

  constructor(a: ProsemirrorNode, b: ProsemirrorNode, force = false) {
    this.from = new Tree(a);
    this.to = new Tree(b);

    if (force && !a.sameMarkup(b)) {
      throw new Error(`force mode has to run with the same root`);
    }

    // add match of dummy roots
    this.matched = new Match(this.from, this.to).add(-1, -1);
    this.good = this.matched.has(0, 0);
    if (!force && !this.good) {
      return;
    }

    const ignoreRootInsertion = force && !this.matched.has(0, 0);
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

    ignoreRootInsertion && this.ops.shift();
    this.deletePhase(ignoreRootInsertion);
  }

  patch(tr: Transaction, start = 0) {
    const patch = new Patch(this, tr, start);
    console.log("ops", this.ops.length);
    this.ops.forEach((op) => {
      switch (op.type) {
        case 1:
          patch.move(op);
          break;
        case 2:
          patch.insert(op);
          break;
        case 3:
          patch.update(op);
          break;
        case 4:
          patch.delete(op);
          break;
      }
    });
    return tr;
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

    this.mergeInsertions();
  }

  private mergeInsertions() {}

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

  private deletePhase(ignoreRootDeletion = false) {
    const i = this.ops.length;
    this.from.postOrder((from) => {
      // merge leaves deletion into sub-tree deletion
      if (ignoreRootDeletion && from === 0) {
        return;
      }

      if (!this.matched.from.has(from)) {
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

export default function diff(
  from: ProsemirrorNode,
  to: ProsemirrorNode,
  force = false
) {
  return new LaDiff(from, to, force);
}
