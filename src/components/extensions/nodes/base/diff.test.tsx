import {
  doc,
  blockquote,
  h1,
  h2,
  p,
  em,
  strong,
  ul,
  ol,
  li,
  br,
  eq,
} from "prosemirror-test-builder";

import diff from "./diff";

function move1Leaf() {
  return diff(doc(p("a"), p("b")), doc(p("b"), p("a")));
}

function moveSubTrees() {
  return diff(
    doc(blockquote(p("b"), p("c")), blockquote(p("a"))),
    doc(blockquote(p("a"), blockquote(p("b"), p("c"))))
  );
}

function insert2Leaves() {
  return diff(
    doc(p("a"), p("b"), p("c")),
    doc(br(), p("a"), p("b"), p("c"), br())
  );
}

function delete1Leaf() {
  return diff(doc(p("a", em("b"), "c")), doc(p("a", em("b"))));
}

function update1Leaf() {
  return diff(doc(p("a", em("b"), "c")), doc(p("a", em("b"), "cd")));
}

function replace1Leaf() {
  return diff(doc(p("a", em("b"), "c")), doc(p("a", em("b"), "acb")));
}

describe("diff", () => {
  it("not good", () => {
    const v = diff(doc(p("a"), p("b")), doc(br(), p("a"), br(), p("b")));
    expect(v.good()).toBe(false);
  });

  it("no difference", () => {
    const v = diff(doc(p("a"), p("b")), doc(p("a"), p("b")));
    expect(v.good()).toBe(true);
    expect(v.ops).toMatchObject([]);
  });

  it("move 1 leaf", () => {
    expect(move1Leaf().ops).toMatchObject([
      { type: 1, from: 1, parent: 0, index: 1 },
    ]);
  });

  it("move sub-trees", () => {
    expect(moveSubTrees().ops).toMatchObject([
      { type: 2, parent: 0, index: 0, to: 1 },
      { type: 1, from: 10, index: 0 },
      { type: 1, from: 1, index: 1 },
      { type: 4, from: 9 },
    ]);
  });

  it("insert 2 leaves", () => {
    expect(insert2Leaves().ops).toMatchObject([
      { type: 2, index: 0, parent: 0, to: 1 },
      { type: 2, index: 4, parent: 0, to: 11 },
    ]);
  });

  it("delete 1 leaf", () => {
    expect(delete1Leaf().ops).toMatchObject([{ type: 4, from: 4 }]);
  });

  it("update 1 leaf", () => {
    expect(update1Leaf().ops).toMatchObject([{ type: 3, from: 4, to: 4 }]);
  });

  it("replace 1 leaf", () => {
    expect(replace1Leaf().ops).toMatchObject([
      { type: 2, index: 2, parent: 1, to: 4 },
      { type: 4, from: 4 },
    ]);
  });
});

// describe("patch", () => {
//   it("move 1 leaf", () => {});

//   it("move sub-trees", () => {});

//   it("insert 2 leaves", () => {});

//   it("delete a leaf", () => {});
// });
