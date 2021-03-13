import {
  doc,
  blockquote,
  p,
  em,
  br,
  hr,
  ul,
  li,
} from "prosemirror-test-builder";
import { EditorState } from "prosemirror-state";
import { Node as ProsemirrorNode, Schema } from "prosemirror-model";

import diff, {
  compare,
  selectPath,
  pathLCS,
  matchCriterion1,
  Tree,
  matchCriterion2,
  pathHas,
  Match,
  matchLeaves,
  matchInteriors2,
  matchInteriors1,
  matchCriterion3,
  makeMatching,
} from "./diff";

// function diffAndPatch(
//   a: ProsemirrorNode,
//   b: ProsemirrorNode,
//   ops?: any,
//   start = 0,
//   force = false
// ) {
//   const r = diff(a, b, force);
//   if (ops) {
//     expect(r.ops).toMatchObject(ops);
//   }
//   const state = EditorState.create({ schema: a.type.schema, doc: r.from.root });
//   const node = r.patch(state.tr, start).doc.resolve(start).parent;
//   expect(node).toEqual(r.to.root);
// }

// describe("ordinary schema", () => {
//   it("not good", () => {
//     const v = diff(doc(p("a"), p("b")), doc(br(), p("a"), br(), p("b")));
//     expect(v.good).toBe(false);
//   });

//   it("no difference", () => {
//     const v = diff(doc(p("a"), p("b")), doc(p("a"), p("b")));
//     expect(v.good).toBe(true);
//     expect(v.ops).toMatchObject([]);
//   });

//   it("move 1 sub-tree", () => {
//     diffAndPatch(doc(p("a"), p("b")), doc(p("b"), p("a")), [
//       { type: 1, from: 1, parent: 0, index: 1 },
//     ]);
//   });

//   it("move sub-trees", () => {
//     diffAndPatch(
//       doc(blockquote(p("b"), p("c")), blockquote(p("a"))),
//       doc(blockquote(p("a"), blockquote(p("b"), p("c")))),
//       [
//         { type: 2, parent: 0, index: 0, to: 1 },
//         { type: 1, from: 10, index: 0 },
//         { type: 1, from: 1, index: 1 },
//         { type: 4, from: 9 },
//       ]
//     );
//   });

//   it("insert 2 leaves", () => {
//     diffAndPatch(
//       doc(p("a"), p("b"), p("c")),
//       doc(hr(), p("a"), p("b"), p("c"), hr()),
//       [
//         { type: 2, index: 0, parent: 0, to: 1 },
//         { type: 2, index: 4, parent: 0, to: 11 },
//       ]
//     );
//   });

//   it("delete 1 leaf", () => {
//     diffAndPatch(doc(p("a", em("b"), "c")), doc(p("a", em("b"))), [
//       { type: 4, from: 4 },
//     ]);
//   });

//   it("update 1 leaf", () => {
//     diffAndPatch(doc(p("a", em("b"), "c")), doc(p("a", em("b"), "cd")), [
//       { type: 3, from: 4, to: 4 },
//     ]);
//   });

//   it("replace 1 leaf", () => {
//     diffAndPatch(doc(p("a", em("b"), "c")), doc(p("a", em("b"), "acb")), [
//       { type: 2, index: 2, parent: 1, to: 4 },
//       { type: 4, from: 4 },
//     ]);
//   });

//   it("unwrap a sub-tree", () => {
//     const a = doc(
//       ul(
//         li(
//           p("foo"),
//           ul(
//             li(
//               ul(li(p(em("- "), "barx"))),
//               ul(li(p(em("- "), "baz"), p(br()), p(br()), p(em(" "), "bim")))
//             ),
//             li(p(em("- "), "xyz")),
//             li(p(em("- "), "hhh"))
//           )
//         )
//       )
//     );

//     const b = doc(
//       ul(
//         li(
//           p("foo"),
//           ul(
//             li(
//               p(em("- "), "barx"),
//               ul(li(p(em("- "), "baz"), p(br()), p(br()), p(em(" "), "bim")))
//             ),
//             li(p(em("- "), "xyz")),
//             li(p(em("- "), "hhh"))
//           )
//         )
//       )
//     );

//     diffAndPatch(a, b, [
//       { type: 1, index: 0, depth: 5 },
//       { type: 4, from: 10 },
//     ]);
//   });

//   it("an insertion interfered by another insertion", () => {
//     const a = doc(p("a", em("b"), "c"));
//     const b = doc(p("a", em("b"), "c", em("hello")), p("d"));

//     diffAndPatch(a, b, [
//       { type: 2, index: 1, parent: 0, depth: 1 },
//       { type: 2, index: 3, parent: 1, depth: 2 },
//       { type: 2, index: 0, depth: 2 },
//     ]);
//   });

//   it("update a intra-moved sub-tree", () => {
//     const a = doc(blockquote(p("b"), p("c"), p("d")), p("a"));
//     const b = doc(p("a"), blockquote(p("b"), p("c"), p("dd")));

//     diffAndPatch(a, b, [{ type: 1, parent: 0, index: 1 }, { type: 3 }]);
//   });

//   it("insert in a intra-moved sub-tree", () => {
//     const a = doc(blockquote(p("b"), p("c")), p("a"));
//     const b = doc(p("a"), blockquote(p("b"), p("c"), p("dd")));

//     diffAndPatch(a, b, [
//       { type: 1, parent: 0, index: 1 },
//       { type: 2, depth: 2 },
//       { type: 2, depth: 3 },
//     ]);
//   });

//   it("move in a moved sub-tree", () => {
//     const a = doc(
//       ul(
//         li(
//           p("aaa"),
//           p("xyz"),
//           ul(li(p("bbb"), p("ccc"), p("ddd")), li(p("eee"), p("fff"), p("ggg")))
//         )
//       )
//     );
//     const b = doc(
//       ul(
//         li(
//           p("xyz"),
//           ul(
//             li(p("bbb"), p("ccc"), p("ddd")),
//             li(p("fff"), p("ggg"), p("eee"))
//           ),
//           p("aaa")
//         )
//       )
//     );

//     diffAndPatch(a, b, [
//       { type: 1, index: 2, depth: 3 },
//       { type: 1, index: 2, depth: 5 },
//     ]);
//   });

//   it("force patch", () => {
//     const a = doc(
//       p("- foo\n  - bar\n    - baz\n\n\n      bim\n  - xyz\n  - hhh")
//     );
//     const b = doc(
//       ul(
//         li(
//           p(em("- "), "foo"),
//           ul(
//             li(
//               p(em("  - "), "bar"),
//               ul(
//                 li(
//                   p(em("    - "), "baz"),
//                   p(br()),
//                   p(br()),
//                   p(em("      "), "bim")
//                 )
//               )
//             ),
//             li(p(em("  - "), "xyz")),
//             li(p(em("  - "), "hhh"))
//           )
//         )
//       )
//     );

//     diffAndPatch(a, b, null, 0, true);
//   });

//   it("take hold of correct marks", () => {
//     const a = doc(
//       ul(li(p(em("1234567"), "baz"), p(br()), p(br()), p(em("      "), "bim")))
//     );
//     const b = doc(
//       ul(li(p(em("1234567"), "baz"), p(br()), p(br()), p(em("     "), " bim")))
//     );
//     diffAndPatch(a, b, [{ type: 3 }, { type: 3 }]);
//   });

//   it("insert a list", () => {
//     diffAndPatch(
//       doc(p("a"), p("b"), p("c")),
//       doc(p("a"), p("b"), p("c"), ul(li(p(em("1234567"), "baz"))))
//       // [{ type: 2 }]
//     );
//   });

//   it("twist list item", () => {
//     const a = doc(ul(li(p("bar"), ul(li(p("baz"), p("bim"))))));
//     const b = doc(ul(li(p("bar"), ul(li(p("baz"))), p("bim"))));
//     // const a = doc(
//     //   ul(
//     //     li(
//     //       p(em("- "), "bar"),
//     //       ul(li(p(em("  - "), "baz"), p(br()), p(em("    "), "bim"), p(br())))
//     //     )
//     //   )
//     // );
//     // const b = doc(
//     //   ul(
//     //     li(
//     //       p(em("- "), "bar"),
//     //       ul(li(p(em("   - "), "baz"), p(br()))),
//     //       p(em("  "), "  bim"),
//     //       p(br())
//     //     )
//     //   )
//     // );
//     // diffAndPatch(a, b);
//     // diffAndPatch(b, a);
//     const t = diff(a, b);
//     // console.log(t.from.points);
//     // console.log(t.from.points.map((x) => t.from.nodes[x].size()));
//     // console.log(t.from.points.map((x) => t.from.nodes[x].path));
//   });
// });

const figure6 = {
  tx: new Tree(
    doc(
      /* 0 */
      blockquote(
        /* 1 */
        p(/* 2 */ "structured documents" /* 3 */),
        ul(/* 24 */ li(/* 25 */ p(/* 26 */ "change detection" /* 27 */)))
      )
    )
  ),
  ty: new Tree(
    doc(
      /* 0 */
      ul(
        /* 1 */
        li(
          /* 2 */
          blockquote(/* 3 */ p(/* 4 */ "structured documents" /* 5 */)),
          p(/* 27 */ "change detection" /* 28 */)
        )
      )
    )
  ),
};

const figure8 = {
  tx: new Tree(
    doc(
      /* 0 */
      ul(
        /* 1 */
        li(
          /* 2 */
          p(/* 3 */ "... structured documents ..." /* 4 */),
          blockquote(/* 33 */ p(/* 34 */ "... change detection ..." /* 35 */))
        )
      )
    )
  ),
  ty: new Tree(
    doc(
      /* 0 */
      blockquote(
        /* 1 */
        ul(
          /* 2 */
          li(
            /* 3 */
            p(/* 4 */ "... structured documents ..." /* 5 */),
            p(/* 34 */ "... change detection ..." /* 35 */)
          )
        )
      )
    )
  ),
};

const figure10 = {
  tx: new Tree(
    doc(
      /* 0 */
      ul(
        /* 1 */
        li(/* 2 */ p(/* 3 */ "sgml" /* 4 */), p(/* 9 */ "xml" /* 10 */)),
        li(
          /* 15 */ p(/* 16 */ "change" /* 17 */),
          p(/* 24 */ "detection" /* 25 */)
        )
      )
    )
  ),
  ty: new Tree(
    doc(
      /* 0 */
      ul(
        /* 1 */
        li(/* 2 */ p(/* 3 */ "sgml" /* 4 */), p(/* 9 */ "change" /* 10 */)),
        li(
          /* 18 */ p(/* 19 */ "xml" /* 20 */),
          p(/* 24 */ "detection" /* 25 */)
        )
      )
    )
  ),
};

describe("algorithm", () => {
  const tx = new Tree(
    doc(
      /* 0 */
      ul(
        /* 1 */
        li(
          /* 2 */
          p(/* 3 */ em(/* 4 */ "- "), /* 6 */ "bar"),
          ul(
            /* 10 */
            li(
              /* 11 */
              p(/* 12 */ em(/* 13 */ "  - "), /* 17 */ "baz"),
              p(/* 21 */ br(/* 22 */)),
              p(/* 24 */ em(/* 25 */ "    "), /* 29 */ "bim"),
              p(/* 33 */ br(/* 34 */))
            )
          )
        )
      )
    )
  );

  const ty = new Tree(
    doc(
      /* 0 */
      ul(
        /* 1 */
        li(
          /* 2 */
          p(/* 3 */ em(/* 4 */ "- "), /* 6 */ "bar"),
          ul(
            /* 10 */
            li(
              /* 11 */
              p(/* 12 */ em(/* 13 */ "   - "), /* 18 */ "baz"),
              p(/* 22 */ br(/* 23 */))
            )
          ),
          p(/* 27 */ em(/* 28 */ "  "), /* 30 */ "  bim"),
          p(/* 36 */ br(/* 37 */))
        )
      )
    )
  );

  const leaveMatches = {
    4: [4],
    6: [6],
    18: [17],
    30: [29],
    13: [4, 13, 25],
    23: [22, 34],
    28: [13, 25],
    37: [22, 34],
  };

  const oneToManyLeaves = Object.entries(leaveMatches).filter(
    ([, m]) => m.length > 1
  );

  it("the leaves array is ordered by small to big", () => {
    let n = 0;
    const leaves = tx.leaves;
    for (let i = 1; i < leaves.length; ++i) {
      if (leaves[i] > leaves[i - 1]) {
        ++n;
      }
    }
    expect(n).toBe(Math.max(0, leaves.length - 1));
  });

  it("the corresponding path of a leaf is ordered by big to small", () => {
    tx.leaves.forEach((x) => {
      const path = tx.nodes[x].path;
      let n = 0;
      for (let i = 1; i < path.length; ++i) {
        if (path[i] < path[i - 1]) {
          ++n;
        }
      }
      expect(n).toBe(Math.max(0, path.length - 1));
    });
  });

  it("lookup nodes in path by binary search", () => {
    const baz = tx.nodes[17];
    baz.path.forEach((a) => expect(pathHas(baz, a)).toBe(true));
    tx.leaves
      .filter((x) => x !== baz.id)
      .forEach((x) => expect(pathHas(baz, x)).toBe(false));
  });

  it("comparing same leaves should be 0", () => {
    expect(compare(tx.nodes[6], ty.nodes[6])).toBe(0);
  });

  it("comparing leaves with 1 diff should be < 1", () => {
    expect(compare(tx.nodes[29], ty.nodes[30])).toBeLessThan(1);
  });

  it("comparing leaves with 2 or more diffs should be >= 1", () => {
    expect(compare(tx.nodes[6], ty.nodes[18])).toBeGreaterThanOrEqual(1);
    expect(compare(tx.nodes[17], ty.nodes[30])).toBeGreaterThanOrEqual(1);
  });

  it("path-match algorithm might produce one-to-many matchings for interiors", () => {
    const { tx, ty } = figure10;
    const m = new Match();
    matchLeaves(tx, ty, m);
    matchInteriors1(tx, ty, m);
    expect(m.getY(2)).toMatchObject([2, 18]);
    expect(m.getY(15)).toMatchObject([2, 18]);
    expect(m.getX(2)).toMatchObject([2, 15]);
    expect(m.getX(18)).toMatchObject([2, 15]);
  });

  describe("Definition 1", () => {
    it("the root has an empty path", () => {
      expect(tx.nodes[0].path).toMatchObject([]);
    });

    it("other nodes has a path from parent up to root", () => {
      Object.keys(tx.nodes).forEach((key) => {
        const x = parseInt(key);
        const path = tx.nodes[x].path;
        for (let i = 0; i < path.length; ++i) {
          const parent = tx.nodes[path[i]];
          const child = tx.nodes[i === 0 ? x : path[i - 1]];
          expect(parent.children[child.index]).toBe(child.id);
        }
      });
    });
  });

  describe("Definition 3", () => {
    it("completely same leaves should have common CP as long as their path", () => {
      const i = 6;
      expect(tx.nodes[i].node.text).toBe(ty.nodes[i].node.text);
      expect(tx.nodes[i].path).toMatchObject(ty.nodes[i].path);
      const cp1 = pathLCS(tx.nodes[i], ty.nodes[i]);
      expect(cp1.length / 2).toBe(tx.nodes[i].path.length);

      const cp2 = pathLCS(tx.nodes[17], ty.nodes[18]);
      expect(cp2.length).toBe(
        tx.nodes[17].path.length + ty.nodes[18].path.length
      );
    });

    it("common interiors might be inconsistent among different CPs", () => {
      const cp1 = pathLCS(tx.nodes[17], ty.nodes[18]);
      const match1: Record<number, number> = {};
      for (let i = 0; i < cp1.length; i += 2) {
        match1[cp1[i]] = cp1[i + 1];
      }

      const cp2 = pathLCS(tx.nodes[29], ty.nodes[30]);
      const match2: Record<number, number> = {};
      for (let i = 0; i < cp2.length; i += 2) {
        match2[cp2[i]] = cp2[i + 1];
      }

      expect(match1).toMatchObject({ 0: 0, 10: 10, 11: 11 });
      expect(match2).toMatchObject({ 0: 0, 10: 1, 11: 2 });
    });
  });

  describe("Matching Criterion 1", () => {
    it("there are one-to-one matches", () => {
      const matches = Object.entries(leaveMatches).filter(
        ([, m]) => m.length === 1
      );
      expect(matches.length).toBeGreaterThan(0);
      matches.forEach(([y, m]) =>
        expect(matchCriterion1(ty.nodes[parseInt(y)], tx)).toMatchObject(m)
      );
    });

    it("there are one-to-many matches", () => {
      const matches = oneToManyLeaves;
      expect(matches.length).toBeGreaterThan(0);
      matches.forEach(([y, m]) =>
        expect(matchCriterion1(ty.nodes[parseInt(y)], tx)).toMatchObject(m)
      );
    });
  });

  describe("Matching Criterion 2", () => {
    it("one-to-many leaf matchings are changed to one-to-one", () => {
      const oneToOneLeaves: Record<string, number> = {
        13: 13,
        23: 22,
        28: 25,
        37: 34,
      };
      oneToManyLeaves.forEach(([y, m]) => {
        const $y = ty.nodes[parseInt(y)];
        const selected = matchCriterion2($y, m, tx);
        expect(selected).toBe(oneToOneLeaves[y]);
      });
    });
  });

  describe("Matching Criterion 3", () => {
    const { tx, ty } = figure10;
    const m = new Match();
    matchLeaves(tx, ty, m);
    matchInteriors1(tx, ty, m);

    it("one-to-many interior machings are changed to one-to-one", () => {
      const y1 = 2;
      const ym1 = m.getX(y1);
      expect(ym1).toMatchObject([2, 15]);
      matchCriterion3(ty.nodes[y1], ym1!, tx, m);
      expect(m.getX(y1)).toMatchObject([2]);

      const y2 = 18;
      const ym2 = m.getX(y2);
      expect(m.getX(y2)).toMatchObject([2, 15]);
      matchCriterion3(ty.nodes[y2], ym2!, tx, m);
      expect(m.getX(y2)).toMatchObject([15]);
    });
  });

  describe("Create Matchings", () => {
    it("Fig. 6", () => {
      const { tx, ty } = figure6;
      const matching = makeMatching(tx, ty);
      expect(matching.has(24, 1)).toBe(true);
      expect(matching.has(25, 2)).toBe(true);
      expect(matching.has(1, 3)).toBe(true);
    });

    it("Fig. 8", () => {
      const { tx, ty } = figure8;
      const matching = makeMatching(tx, ty);
      expect(matching.has(33, 1)).toBe(false);
    });
  });
});

describe("structures", () => {
  describe("Match", () => {
    it("set/add/has", () => {
      const m = new Match();
      m.add(1, 2).add(1, 3);
      expect(m.has(1, 2)).toBe(true);
      expect(m.has(1, 3)).toBe(true);
      expect(m.has(2, 1)).toBe(false);
    });

    it("getX/getY", () => {
      const m = new Match();
      m.add(1, 2).add(1, 3).add(4, 3);
      expect(m.getY(1)).toMatchObject([2, 3]);
      expect(m.getY(3)).toBeUndefined();
      expect(m.getY(4)).toMatchObject([3]);
      expect(m.getX(1)).toBeUndefined();
      expect(m.getX(3)).toMatchObject([1, 4]);

      m.add(10, 10).add(10, 20).add(11, 10).add(11, 20);
      expect(m.getY(10)).toMatchObject([10, 20]);
      expect(m.getY(11)).toMatchObject([10, 20]);
      expect(m.getX(10)).toMatchObject([10, 11]);
      expect(m.getX(20)).toMatchObject([10, 11]);
    });

    it("dump", () => {
      const m = new Match();
      m.add(1, 2).add(1, 3).add(4, 3);
      expect(m.dump()).toMatchObject([1, 2, 1, 3, 4, 3]);
    });
  });

  describe("FOOOOOOOOOO", () => {
    const schema = new Schema({
      nodes: {
        text: {},
        note: {
          content: "text*",
          toDOM() {
            return ["note", 0];
          },
          parseDOM: [{ tag: "note" }],
        },
        notegroup: {
          content: "note+",
          toDOM() {
            return ["notegroup", 0];
          },
          parseDOM: [{ tag: "notegroup" }],
        },
        doc: {
          content: "(note | notegroup)+",
        },
      },
    });

    const state = EditorState.create({ schema });
    const tr = state.tr;
    tr.replaceRangeWith(0, 1, schema.nodes.notegroup.create());
    console.log(tr.doc.toString());
  });
});
