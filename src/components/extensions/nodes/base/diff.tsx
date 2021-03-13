// implement algorithm depicted in [K.-H. Lee, Y.-C. Choy, and S.-B. Cho. An efficient algorithm to compute differences between structured documents. TKDE. 16(8), 2004]

import { Fragment, Node as ProsemirrorNode, Schema } from "prosemirror-model";
import { Transaction } from "prosemirror-state";
import lcs from "diff-sequences";
import sortedIndex from "lodash.sortedindex";
import sortedIndexBy from "lodash.sortedindexby";

import { dmp } from "../../../editor";

function dfs(
  node: ProsemirrorNode | Fragment,
  from: number,
  to: number,
  f: (
    node: ProsemirrorNode,
    pos: number,
    index: number,
    path: number[],
    after: boolean
  ) => void,
  nodeStart = 0,
  path = [-1]
) {
  for (let i = 0, pos = 0; pos < to; i++) {
    const child = node.child(i);
    const end = pos + child.nodeSize;
    if (end > from) {
      const j = nodeStart + pos;
      f(child, j, i, path, false);
      if (child.content.size) {
        const start = pos + 1;
        path.push(j);

        dfs(
          child,
          Math.max(0, from - start),
          Math.min(child.content.size, to - start),
          f,
          nodeStart + start,
          path
        );

        path.pop();
      }
      f(child, j, i, path, true);
    }

    pos = end;
  }
}

// class Match {
//   readonly from = new Map<number, number>();
//   readonly to = new Map<number, number>();

//   private readonly pairs: number[] = [];

//   constructor(t1: Tree, t2: Tree) {
//     const unmatched1 = new Set<number>();
//     const unmatched2 = new Set<number>();
//     const acyclic = new Map<number, number[]>();

//     t1.postOrder((i) => unmatched1.add(i));
//     t2.postOrder((i) => unmatched2.add(i));

//     for (const from of unmatched1) {
//       const $from = t1.nodes[from];
//       for (const to of unmatched2) {
//         const $to = t2.nodes[to];
//         const similary = this.similarize($from, $to);
//         if (!similary) {
//           continue;
//         }

//         const branches = acyclic.get(from);
//         const hasCycles = branches?.some((x) => $to.contains(x));
//         if (hasCycles) {
//           continue;
//         }

//         if (similary > 0.5) {
//           unmatched2.delete(to);
//           acyclic.delete(from);
//           this.add(from, to);
//           break;
//         }

//         if (branches) {
//           branches.push(to);
//         } else {
//           acyclic.set(from, [to]);
//         }
//       }
//     }
//   }

//   private byEquality(t1: Tree, t2: Tree) {}

//   private bySimilarity() {}

//   private equal(a: Node, b: Node) {}

//   // similarity > 0.5 is considered similar
//   private similarize(a: Node, b: Node) {
//     const { node: n1 } = a;
//     const { node: n2 } = b;

//     // completely different
//     if (n1.type !== n2.type) {
//       return 0;
//     }

//     // for interior nodes we update attrs & markup
//     // TODO: support rename for nodes with compatible content
//     if (!n1.isLeaf) {
//       if (!n1.content.size && !n2.content.size) {
//         return 1;
//       }

//       let common = 0;
//       this.each((x, y) => {
//         if (a.containsLeaf(x) && b.containsLeaf(y)) {
//           ++common;
//         }
//       });
//       return common / Math.max(a.leavesSize(), b.leavesSize());
//     }

//     // for leaves we only allow to update text
//     if (n1.sameMarkup(n2)) {
//       if (!n1.isText || !n1.text || !n2.text) {
//         return 1;
//       }

//       const delta = dmp.diff_main(n1.text, n2.text);
//       const cost = delta.reduce((sum, [op]) => sum + Math.abs(op), 0);
//       const similarity = cost ? 1 / cost : 1;
//       if (similarity > 0.5) {
//         a.delta = delta;
//       }
//       return similarity;
//     }

//     return 0.000001; // treated as 1 common leaf in 1e6 ones
//   }

//   add(x: number, y: number) {
//     this.from.set(x, y);
//     this.to.set(y, x);
//     this.pairs.push(x, y);
//     return this;
//   }

//   has(x: number, y: number) {
//     return this.from.get(x) === y;
//   }

//   each(f: (x: number, y: number) => void) {
//     for (let i = 0; i < this.pairs.length; i += 2) {
//       f(this.pairs[i], this.pairs[i + 1]);
//     }
//   }
// }

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

// class Order {
//   readonly from = new Set<number>();
//   readonly to = new Set<number>();

//   mark(x: number, y: number) {
//     this.from.add(x);
//     this.to.add(y);
//   }
// }

interface INode {
  tree: ITree;
  id: number;
  node: ProsemirrorNode;
  size: number; // number of all nodes in sub-tree rooted at this node, include the sub-root itself
  index: number; // sibling order
  path: number[]; // from parent to root, for root whose path is []
  children: number[];
}

interface IMatch {
  getX(y: number): number[] | undefined;
  getY(x: number): number[] | undefined;
  has(x: number, y: number): boolean;
  add(x: number, y: number): IMatch;
  set(x: number, y: number): IMatch;
  dump(): number[];
}

interface ITree {
  nodes: Record<number, INode>;
  leaves: number[]; // a sorted array of all leaves id

  size(id: number): number;
  has(id: number, root?: number, exclude?: boolean): boolean;
  bfs(f: (id: number) => void): void;
  dfs(f: (id: number) => void, root?: number): void;
}

interface IDiff {
  from: ITree;
  to: Tree;
  ops: OP[];

  willDelete?(id: number): boolean;
}

// class Node {
//   delta?: ReturnType<typeof dmp["diff_main"]>;

//   constructor(
//     readonly tree: ITree,
//     readonly id: number,
//     readonly node: ProsemirrorNode,
//     readonly path: number[],
//     readonly parent: number,
//     readonly index: number,
//     readonly depth: number,
//     readonly children: number[] = [] // the content will be following the diff process
//   ) {}

//   contains(id: number) {
//     return this.id < id && id < this.id + this.node.nodeSize;
//   }

//   containsLeaf(id: number) {
//     return this.contains(id) && this.tree.nodes[id].node.isLeaf;
//   }

//   leavesSize() {
//     if (this.node.isLeaf) {
//       return 0;
//     }
//     const leaves = this.tree.leaves;
//     const lowerBound = sortedIndex(leaves, this.id);
//     const upperBound = sortedIndex(leaves, this.id + this.node.nodeSize);
//     return upperBound - lowerBound;
//   }
// }

// class Tree {
//   readonly breadth: number[][] = [];
//   readonly nodes: Record<number, Node> = {};
//   readonly leaves: number[] = []; // a sorted array
//   readonly points: number[] = []; // a sorted array

//   constructor(readonly root: ProsemirrorNode) {
//     this.breadth[0] = [0];
//     this.nodes[0] = new Node(
//       this,
//       0,
//       root,
//       [-1],
//       -1 /* parent */,
//       0 /* index */,
//       0 /* depth */
//     );
//     // the dummy root(-1) always match with another tree's
//     this.nodes[-1] = new Node(
//       this,
//       -1,
//       null as any,
//       [-1],
//       -1 /* parent */,
//       0 /* index */,
//       -1 /* depth */,
//       [0]
//     );

//     this.points.push(0);
//     dfs(
//       root.content,
//       0,
//       root.content.size,
//       (node, id, index, path) => {
//         path = path.slice();
//         path.reverse();

//         const parent = path[0];
//         this.points.push(id);
//         const $parent = this.nodes[parent];
//         const depth = $parent.depth + 1;
//         if (!this.breadth[depth]) {
//           this.breadth[depth] = [id];
//         } else {
//           this.breadth[depth].push(id);
//         }

//         $parent.children.push(id);
//         const $node = new Node(this, id, node, path, parent, index, depth);
//         if (node.isLeaf) {
//           this.leaves.push(id);
//         }
//         this.nodes[id] = $node;
//       },
//       1,
//       0
//     );
//   }

//   contains(id: number) {
//     return id >= 0 && id < this.root.nodeSize;
//   }

//   bfs(f: (id: number) => void) {
//     this.breadth.forEach((x) => x.forEach(f));
//   }

//   postOrder(f: (id: number) => void, id = 0) {
//     for (const child of this.nodes[id].children) {
//       this.postOrder(f, child);
//     }
//     f(id);
//   }
// }

export class Tree implements ITree {
  readonly breadth: number[][] = [];
  readonly nodes: Record<number, INode> = {};
  readonly leaves: number[] = []; // a sorted array

  constructor(readonly root: ProsemirrorNode) {
    this.breadth[0] = [0];
    this.nodes[0] = {
      tree: this,
      id: 0,
      node: root,
      index: 0,
      path: [],
      children: [],
      size: 1,
    };

    const count = (sum: number, id: number) => sum + this.nodes[id].size;

    dfs(
      root.content,
      0,
      root.content.size,
      (node, id, index, path, after) => {
        if (!after) {
          path = path.slice();
          path.reverse();

          const parent = path[0];
          const $parent = this.nodes[parent];
          const depth = path.length;
          if (!this.breadth[depth]) {
            this.breadth[depth] = [id];
          } else {
            this.breadth[depth].push(id);
          }

          $parent.children.push(id);
          if (!node.content.size) {
            this.leaves.push(id);
          }
          this.nodes[id] = {
            tree: this,
            id,
            node,
            path,
            index,
            children: [],
            size: 1,
          };
        } else {
          const n = this.nodes[id];
          n.size += n.children.reduce(count, 0);
          Object.freeze(n);
        }
      },
      1,
      [0]
    );

    const top = this.nodes[0];
    top.size += top.children.reduce(count, 0);
    Object.freeze(top);
  }

  size(id = 0) {
    return this.nodes[id].size;
  }

  has(id: number, root = 0, exclude = false) {
    const $root = this.nodes[root];
    if (!$root || !this.nodes[id]) {
      return false;
    }

    if (exclude && root === id) {
      return true;
    }

    return root < id && id < root + $root.node.nodeSize;
  }

  bfs(f: (id: number) => void) {
    this.breadth.forEach((x) => x.forEach(f));
  }

  dfs(f: (id: number) => void, id = 0) {
    f(id);
    for (const c of this.nodes[id].children) {
      this.dfs(f, c);
    }
  }
}

export class Match implements IMatch {
  private readonly xm = new Map<number, number[]>();
  private readonly ym = new Map<number, number[]>();
  private readonly s = new Set<string>();

  private key(x: number, y: number) {
    return `${x}-${y}`;
  }

  getX(y: number): number[] | undefined {
    return this.ym.get(y);
  }

  getY(x: number): number[] | undefined {
    return this.xm.get(x);
  }

  has(x: number, y: number) {
    return this.s.has(this.key(x, y));
  }

  add(x: number, y: number) {
    if (!this.has(x, y)) {
      const xv = this.xm.get(x);
      if (xv) {
        xv.push(y);
      } else {
        this.xm.set(x, [y]);
      }

      const yv = this.ym.get(y);
      if (yv) {
        yv.push(x);
      } else {
        this.ym.set(y, [x]);
      }

      this.s.add(this.key(x, y));
    }
    return this;
  }

  set(x: number, y: number) {
    this.xm.set(x, [y]);
    this.ym.set(y, [x]);
    return this;
  }

  dump() {
    const output: number[] = [];
    this.xm.forEach((value, x) => {
      for (const y of value) {
        output.push(x, y);
      }
    });
    return output;
  }
}

// implement Definition 3
export function pathLCS($x: INode, $y: INode) {
  const { path: s1, tree: t1 } = $x;
  const { path: s2, tree: t2 } = $y;
  const commons: number[] = [];

  lcs(
    s1.length,
    s2.length,
    (i, j) => t1.nodes[s1[i]].node.type === t2.nodes[s2[j]].node.type,

    (n, i, j) => {
      for (; n !== 0; n--, i++, j++) {
        commons.push(s1[i], s2[j]);
      }
    }
  );

  return commons;
}

// examine if a node path contains an ID
export function pathHas({ path }: INode, id: number) {
  // the path is not too long, so lookup elements by BinarySearch should be almost as quick as in Hash table
  let first = 0;
  let last = path.length;

  while (first < last) {
    const mid = first + Math.floor((last - first) / 2);
    const value = path[mid];
    if (value === id) {
      return true;
    }

    if (value > id) {
      first = mid + 1;
    } else {
      last = mid;
    }
  }

  return false;
}

// produce interiors matchings from CP of matched leaves
export function pathMatch($x: INode, $y: INode, matching: IMatch) {
  const { path: oldPath, tree: tx, size: sx } = $x;
  const { path: newPath, tree: ty, size: sy } = $y;

  if (sx !== 1 || sy !== 1) {
    throw new Error(`both $x and $y should be a leaf`);
  }

  const m = oldPath.length;
  const n = newPath.length;

  let j = 0;
  for (let i = 0; i < m && j < n; ++i) {
    for (let k = j; k < n; ++k) {
      const x = oldPath[i];
      const y = newPath[k];
      // A condition for preserving the ancestor order in the corresponding paths
      if (matching.getX(y)?.some((x) => pathHas($x, x))) {
        // it is not necessary to proceed further due to the characteristics of the path
        return;
      }

      if (tx.nodes[x].node.type === ty.nodes[y].node.type) {
        matching.add(x, y);
        ++j;
        break;
      }
    }
  }
}

// the value returned is in the range [0, 2], the lower the more similar
export function compare($x: INode, $y: INode): number {
  const nx = $x.node;
  const ny = $y.node;

  if ($x.size === 1 && $y.size === 1 && nx.sameMarkup(ny)) {
    // leaves
    if (!nx.isText || !nx.text || !ny.text) {
      return 0;
    }

    const delta = dmp.diff_main(nx.text, ny.text);
    const cost = delta.reduce((sum, [op]) => sum + Math.abs(op), 0);
    return Math.min(cost / 2, 2);
  }

  return 2;
}

// complexity: O(c*N)
// TODO: optimize to O(c*logN)
// create one-to-many matchings with tx for a leaf $y
export function matchCriterion1($y: INode, tx: ITree, threshold = 1) {
  if ($y.size !== 1) {
    throw new Error("$y should be a leaf");
  }

  let min = 2;
  const ty = $y.tree;
  const matches: number[] = [];
  for (const x of tx.leaves) {
    const $x = tx.nodes[x];
    const $px = tx.nodes[$x.path[0]];
    const $py = ty.nodes[$y.path[0]];
    if (!$px || !$py || $px.node.type !== $py.node.type) {
      // TODO: extend: allow compatible parent nodes, e.g. heading <-> paragraph
      continue;
    }

    const value = compare($x, $y);
    if (value >= threshold || value > min) {
      continue;
    }

    if (value < min) {
      min = value;
      matches.splice(0);
    }
    matches.push(x);
  }

  return matches;
}

// implement Defintion 4
export function selectPath($y: INode, matches: number[], tx: ITree) {
  if (matches.length < 2) {
    return matches[0];
  }

  const commonPaths: ReturnType<typeof pathLCS>[] = [];
  let longest = -1;

  for (let i = 0, max = 0; i < matches.length; ++i) {
    const commons = pathLCS(tx.nodes[matches[i]], $y);
    const l = commons.length;
    commonPaths.push(commons);

    // the initial max is 0, means at least both roots have to be matched
    if (l > max) {
      longest = i;
      max = l;
    }
  }

  if (longest === -1) {
    return undefined;
  }

  if (longest < commonPaths.length - 1) {
    // there exists more than one CP, choose one whose LCS has the largest number of pairs of nodes with the same sibling order
    const ty = $y.tree;
    for (let i = longest, max = 0; i < commonPaths.length; ++i) {
      const commonPath = commonPaths[i];
      let n = 0;
      for (let j = 0; j < commonPath.length; j += 2) {
        const { index: xi } = tx.nodes[commonPath[j]];
        const { index: yi } = ty.nodes[commonPath[j + 1]];
        if (xi === yi) {
          ++n;
        }
      }

      if (n > max) {
        longest = i;
        max = n;
      }
    }
  }

  return matches[longest];
}

// implement defintion 5
export function selectMatch(
  $from: INode,
  matches: number[],
  range: ITree,
  getMatching: (id: number) => number[] | undefined
) {
  const descendants: number[] = [];
  $from.tree.dfs((id) => descendants.push(id), $from.id);

  let max = 0;
  const ones: number[] = [];
  for (const to of matches) {
    let commons = 0;
    for (const from of descendants) {
      if (getMatching(from)?.some((i) => range.has(i, to))) {
        ++commons;
      }
    }
    const similarity = commons / range.nodes[to].size;
    if (similarity < max) {
      continue;
    }

    if (similarity > max) {
      max = similarity;
      ones.splice(0);
    }
    ones.push(to);
  }

  return ones;
}

// change one-to-many matchings with tx for a leaf $y to one-to-one
export function matchCriterion2($y: INode, matches: number[], tx: ITree) {
  if ($y.size !== 1) {
    throw new Error("$y should be a leaf");
  }
  return selectPath($y, matches, tx);
}

// change one-to-many matchings with tx for a interior $y to one-to-one
export function matchCriterion3(
  $y: INode,
  matches: number[],
  tx: ITree,
  matching: IMatch
) {
  if ($y.size < 2) {
    throw new Error("$y should be an interior");
  }

  if (matches.length < 2) {
    return;
  }

  const ones = selectMatch($y, matches, tx, matching.getX.bind(matching));

  let one: number | undefined;
  if (ones.length > 1) {
    const sameSiblingOrder = ones.filter((x) => tx.nodes[x].index === $y.index);
    one = selectPath($y, sameSiblingOrder.length ? sameSiblingOrder : ones, tx);
  } else {
    one = ones[0];
  }

  if (one === undefined) {
    throw new Error(`has no match for ${$y.id}`);
  }

  matching.set(one, $y.id);
}

// create one-to-one matchings for all leaf nodes of ty
export function matchLeaves(tx: ITree, ty: ITree, matching: IMatch) {
  ty.leaves.forEach((y) => {
    const $y = ty.nodes[y];
    const x = matchCriterion2($y, matchCriterion1($y, tx), tx);
    if (x !== undefined) {
      matching.add(x, y);
    }
  });
}

// create one-to-many matchings for all interior nodes of ty
export function matchInteriors1(tx: ITree, ty: ITree, matching: IMatch) {
  ty.leaves.forEach((y) => {
    const matches = matching.getX(y);
    if (matches) {
      const $y = ty.nodes[y];
      for (const x of matches) {
        pathMatch(tx.nodes[x], $y, matching);
      }
    }
  });
}

// change one-to-many matchings for all interior nodes of ty to one-to-one
export function matchInteriors2(tx: ITree, ty: ITree, matching: IMatch) {
  ty.bfs((y) => {
    const $y = ty.nodes[y];
    if ($y.size > 1) {
      // TODO: retrieve all keys from matching directly
      const matches = matching.getX(y);
      if (matches && matches.length > 1) {
        matchCriterion3($y, matches, tx, matching);
      }
    }
  });
}

export function makeMatching(tx: ITree, ty: ITree): IMatch {
  const matching = new Match();
  matchLeaves(tx, ty, matching);
  matchInteriors1(tx, ty, matching);
  matchInteriors2(tx, ty, matching);
  return matching;
}

export function nilCriterion() {}

export function makeEditScript(tx: ITree, ty: ITree, matching: IMatch) {
  tx.bfs((x) => {
    const matches = matching.getY(x);
    if (!matches) {
      // delete x
    } else if (matches.length === 1) {
    } else {
    }
  });

  ty.bfs((y) => {
    if (!matching.getX(y)) {
      // insert y
    }
  });
}

// class Patch {
//   private readonly moved: MOV[] = [];

//   constructor(
//     readonly diff: IDiff,
//     readonly tr: Transaction,
//     readonly start = 0
//   ) {}

//   private getPos(id: number) {
//     const nodes = this.diff.from.nodes;
//     const $node = nodes[id];
//     const parent = $node.parent;
//     if (parent === -1) {
//       return this.start;
//     }

//     if (id >= this.diff.from.root.nodeSize) {
//       // new inserted node
//       return this.getChildPos(parent, $node.index);
//     }

//     if (this.moved.length) {
//       const i = sortedIndexBy<Pick<OP, "from">>(
//         this.moved,
//         { from: id },
//         "from"
//       );

//       if (i < this.moved.length) {
//         const $moved = this.moved[i];
//         if ($moved.from === id) {
//           // just is the moved one, finding through MOV
//           return this.getChildPos($moved.parent, $moved.index);
//         }
//       }

//       if (i > 0 && nodes[this.moved[i - 1].from].contains(id)) {
//         // under a moved ancestor, finding by its parent
//         return this.getChildPos(parent, $node.index);
//       }
//     }

//     return this.tr.mapping.map(id);
//   }

//   private getChildPos(parent: number, index: number) {
//     if (parent === -1) {
//       return this.start;
//     }

//     const $node = this.tr.doc.resolve(this.getPos(parent));

//     let pos = $node.start();
//     const node = $node.parent;
//     for (let i = 0; i < node.childCount && i !== index; ++i) {
//       pos += node.child(i).nodeSize;
//     }
//     return pos + 1;
//   }

//   move(op: MOV) {
//     const pos = this.getPos(op.from);
//     const $from = this.diff.from.nodes[op.from];
//     const $pos = this.tr.doc.resolve(pos);

//     let start = pos - 1;
//     let node = $pos.parent;
//     if ($from.node.isText) {
//       if ($pos.textOffset === 0) {
//         // the text node has been removed heading content
//         start = pos;
//       }

//       node = node.child($pos.index());
//     }

//     if (!this.diff.willDelete || !this.diff.willDelete(op.from)) {
//       this.tr.delete(start, start + node.nodeSize);
//     }

//     this.moved.push(op);
//     this.moved.sort((a, b) => a.from - b.from);
//     this.tr.insert(this.getChildPos(op.parent, op.index) - 1, node);
//   }

//   insert(op: INS) {
//     const pos = this.getChildPos(op.parent, op.index);
//     const { node } = this.diff.to.nodes[op.to];
//     this.tr.insert(pos - 1, op.tree || node.isInline ? node : node.copy());
//   }

//   private updateText(pos: number, delta: NonNullable<Node["delta"]>) {
//     const $pos = this.tr.doc.resolve(pos);
//     const schema = this.tr.doc.type.schema as Schema;
//     const marks = $pos.parent.child($pos.index()).marks;

//     delta.forEach(([code, text]) => {
//       if (code === 0) {
//         pos += text.length;
//       } else if (code < 0) {
//         this.tr.delete(pos, pos + text.length);
//       } else {
//         this.tr.replaceRangeWith(pos, pos, schema.text(text, marks));
//         pos += text.length;
//       }
//     });
//   }

//   update(op: UPD) {
//     const pos = this.getPos(op.from) - 1;
//     const { delta } = this.diff.from.nodes[op.from];
//     if (delta) {
//       this.updateText(pos, delta);
//     } else {
//       const { node } = this.diff.to.nodes[op.to];
//       this.tr.setNodeMarkup(pos, node.type, node.attrs, node.marks);
//     }
//   }

//   delete(op: DEL) {
//     const pos = this.getPos(op.from);
//     const { node } = this.diff.from.nodes[op.from];
//     this.tr.delete(
//       pos - 1,
//       node.isText ? pos - 1 + node.nodeSize : this.tr.doc.resolve(pos).after()
//     );
//   }
// }

// export class LaDiff implements IDiff {
//   readonly ops: OP[] = [];
//   readonly ordered = new Order();
//   readonly matched: Match;
//   readonly from: Tree;
//   readonly to: Tree;
//   readonly good: boolean;

//   private delItems?: OP[];

//   constructor(a: ProsemirrorNode, b: ProsemirrorNode, force = false) {
//     this.from = new Tree(a);
//     this.to = new Tree(b);

//     if (force && !a.sameMarkup(b)) {
//       throw new Error(`force mode has to run with the same root`);
//     }

//     // add match of dummy roots
//     this.matched = new Match(this.from, this.to).add(-1, -1);
//     this.good = this.matched.has(0, 0);
//     if (!force && !this.good) {
//       return;
//     }

//     const ignoreRootInsertion = force && !this.matched.has(0, 0);
//     let counter = a.nodeSize;
//     this.to.bfs((to) => {
//       const $to = this.to.nodes[to];
//       const from = this.matched.to.get(to);
//       if (from === undefined) {
//         this.insertPhase(counter++, $to);
//       } else {
//         const $from = this.from.nodes[from];
//         this.updatePhase($from, $to);
//         this.movePhase($from, $to);
//       }
//     });

//     ignoreRootInsertion && this.ops.shift();
//     this.deletePhase(ignoreRootInsertion);
//   }

//   willDelete(id: number) {
//     if (this.delItems) {
//       const i = sortedIndexBy<Pick<DEL, "from">>(
//         this.delItems,
//         { from: id },
//         "from"
//       );

//       if (i < this.delItems.length && this.delItems[i].from === i) {
//         return true;
//       }

//       if (i > 0 && this.from.nodes[this.delItems[i - 1].from].contains(id)) {
//         return true;
//       }
//     }
//     return false;
//   }

//   patch(tr: Transaction, start = 0) {
//     const patch = new Patch(this, tr, start);
//     console.log("ops", this.ops.length);
//     this.ops.forEach((op) => {
//       switch (op.type) {
//         case 1:
//           patch.move(op);
//           break;
//         case 2:
//           patch.insert(op);
//           break;
//         case 3:
//           patch.update(op);
//           break;
//         case 4:
//           patch.delete(op);
//           break;
//       }
//     });
//     return tr;
//   }

//   private insertPhase(from: number, $to: Node) {
//     const { parent, id: to } = $to;
//     const $px = this.from.nodes[this.matched.to.get(parent)!];
//     const index = this.findIndex($px, $to.tree.nodes[parent], to);
//     $px.children.splice(index, 0, from);
//     const $from = (this.from.nodes[from] = new Node(
//       this.from,
//       from,
//       null as any,
//       [$px.id],
//       $px.id,
//       index,
//       $px.depth + 1
//     ));

//     this.ops.push({
//       type: 2,
//       from,
//       to,
//       index,
//       parent: $from.parent,
//       depth: $from.depth,
//     });
//     this.matched.add(from, to);
//     this.ordered.mark(from, to);

//     this.mergeInsertions();
//   }

//   private mergeInsertions() {
//     // transform insertions to a copy
//   }

//   private updatePhase($from: Node, $to: Node) {
//     if (!$from.node.sameMarkup($to.node) || $from.node.text !== $to.node.text) {
//       this.ops.push({ type: 3, from: $from.id, to: $to.id });
//     }
//   }

//   private movePhase($from: Node, $to: Node) {
//     if (!this.matched.has($from.parent, $to.parent)) {
//       const from = $from.id;
//       const to = $to.id;
//       const $px = $from.tree.nodes[this.matched.to.get($to.parent)!];
//       const $py = $to.tree.nodes[$to.parent];
//       const index = this.findIndex($px, $py, to);
//       $px.children.splice(index, 0, from);

//       // cleanup in old parent
//       const $p = $from.tree.nodes[$from.parent];
//       const i = $p.children.indexOf(from);
//       if (i === -1) {
//         throw new Error(`Not found index of ${from}`);
//       }
//       $p.children.splice(i, 1);

//       this.ops.push({
//         type: 1,
//         from,
//         index,
//         parent: $px.id,
//         depth: $px.depth + 1,
//       });
//       this.ordered.mark(from, to);
//     }

//     this.alignChildren($from, $to);
//   }

//   private deletePhase(ignoreRootDeletion = false) {
//     const i = this.ops.length;
//     this.from.postOrder((from) => {
//       // merge leaves deletion into sub-tree deletion
//       if (ignoreRootDeletion && from === 0) {
//         return;
//       }

//       if (!this.matched.from.has(from)) {
//         let j = this.ops.length;
//         while (j > i && this.from.nodes[this.ops[j - 1].from].parent === from) {
//           --j;
//         }
//         this.ops.splice(j, Infinity, { type: 4, from });
//       }
//     });
//     this.delItems = this.ops.slice(i);
//   }

//   private alignChildren($from: Node, $to: Node) {
//     const { matched, ordered } = this;

//     const s1 = $from.children.filter((from) => {
//       const to = matched.from.get(from);
//       return to && $to.tree.nodes[to].parent === $to.id;
//     });

//     const s2 = $to.children.filter((to) => {
//       const from = matched.to.get(to);
//       return from && $from.tree.nodes[from].parent === $from.id;
//     });

//     lcs(
//       s1.length,
//       s2.length,
//       (i, j) => matched.has(s1[i], s2[j]),
//       (n, i, j) => {
//         for (; n !== 0; n--, i++, j++) {
//           ordered.mark(s1[i], s2[j]);
//         }
//       }
//     );

//     for (const c1 of s1) {
//       const c2 = s2.find((c2) => !ordered.to.has(c2) && matched.has(c1, c2));
//       if (c2) {
//         this.ops.push({
//           type: 1,
//           from: c1,
//           index: this.findIndex($from, $to, c2),
//           parent: $from.id,
//           depth: $from.depth + 1,
//         });
//         ordered.mark(c1, c2);
//       }
//     }
//   }

//   private findIndex($px: Node, $py: Node, y: number) {
//     const { matched, ordered } = this;

//     // find the last sibling before the child that is in order
//     let lastY: number | undefined;
//     for (const id of $py.children) {
//       if (id === y) {
//         break;
//       }
//       if (ordered.to.has(id)) {
//         lastY = id;
//       }
//     }

//     if (lastY === undefined) {
//       return 0;
//     }

//     let i = 0;
//     const lastX = matched.to.get(lastY)!;
//     for (const id of $px.children) {
//       if (id === lastX) {
//         break;
//       }
//       if (ordered.from.has(id)) {
//         ++i;
//       }
//     }

//     return i + 1;
//   }
// }

export default function diff(
  from: ProsemirrorNode,
  to: ProsemirrorNode,
  force = false
) {
  // return new LaDiff(from, to, force);
}
