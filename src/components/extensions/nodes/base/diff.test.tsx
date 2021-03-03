import {
  doc,
  blockquote,
  p,
  em,
  br,
  hr,
  schema,
  ul,
  li,
} from "prosemirror-test-builder";
import { EditorState } from "prosemirror-state";
import { Node as ProsemirrorNode } from "prosemirror-model";

import diff from "./diff";

function createState(doc: ProsemirrorNode) {
  return EditorState.create({ schema, doc });
}

function patch(f: () => ReturnType<typeof diff>, start = 0) {
  const r = f();
  const state = createState(r.from.root);
  const node = r.patch(state.tr, start).doc.resolve(start).parent;
  expect(node).toEqual(r.to.root);
}

function move1SubTree() {
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
    doc(hr(), p("a"), p("b"), p("c"), hr())
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

function complex1() {
  const a = doc(
    ul(
      li(
        p("foo"),
        ul(
          li(
            ul(li(p(em("- "), "barx"))),
            ul(li(p(em("- "), "baz"), p(br()), p(br()), p(em(" "), "bim")))
          ),
          li(p(em("- "), "xyz")),
          li(p(em("- "), "hhh"))
        )
      )
    )
  );

  const b = doc(
    ul(
      li(
        p("foo"),
        ul(
          li(
            p(em("- "), "barx"),
            ul(li(p(em("- "), "baz"), p(br()), p(br()), p(em(" "), "bim")))
          ),
          li(p(em("- "), "xyz")),
          li(p(em("- "), "hhh"))
        )
      )
    )
  );

  return diff(a, b);
}

function complex2() {
  const a = doc(p("a", em("b"), "c"));
  const b = doc(p("a", em("b"), "c", em("hello")), p("d"));
  return diff(a, b);
}

function complex3() {
  const a = doc(blockquote(p("b"), p("c"), p("d")), p("a"));
  const b = doc(p("a"), blockquote(p("b"), p("c"), p("dd")));
  return diff(a, b);
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

  it("move 1 sub-tree", () => {
    expect(move1SubTree().ops).toMatchObject([
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

  it("complex 1", () => {
    expect(complex1().ops).toMatchObject([
      { type: 1, index: 0, depth: 5 },
      { type: 4, from: 10 },
    ]);
  });

  it("complex 2", () => {
    expect(complex2().ops).toMatchObject([
      { type: 2, index: 1, parent: 0, depth: 1 },
      { type: 2, index: 3, parent: 1, depth: 2 },
      { type: 2, index: 0, depth: 2 },
    ]);
  });

  it("complex 3", () => {
    console.log(complex3().ops);
  });
});

describe("patch", () => {
  it("move 1 sub-tree", () => {
    patch(move1SubTree);
  });

  it("move sub-trees", () => {
    patch(moveSubTrees);
  });

  it("insert 2 leaves", () => {
    patch(insert2Leaves);
  });

  it("delete 1 leaf", () => {
    patch(delete1Leaf);
  });

  it("update 1 leaf", () => {
    patch(update1Leaf);
  });

  it("replace 1 leaf", () => {
    patch(replace1Leaf);
  });

  it("complex 1", () => {
    patch(complex1);
  });

  it("complex 2", () => {
    patch(complex2);
  });

  it("complex 3", () => {
    patch(complex3);
  });
});
