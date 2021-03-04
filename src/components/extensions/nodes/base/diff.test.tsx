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

function diffAndPatch(
  a: ProsemirrorNode,
  b: ProsemirrorNode,
  ops?: any,
  start = 0,
  force = false
) {
  const r = diff(a, b, force);
  if (ops) {
    expect(r.ops).toMatchObject(ops);
  }
  const state = EditorState.create({ schema, doc: r.from.root });
  const node = r.patch(state.tr, start).doc.resolve(start).parent;
  expect(node).toEqual(r.to.root);
}

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
  diffAndPatch(doc(p("a"), p("b")), doc(p("b"), p("a")), [
    { type: 1, from: 1, parent: 0, index: 1 },
  ]);
});

it("move sub-trees", () => {
  diffAndPatch(
    doc(blockquote(p("b"), p("c")), blockquote(p("a"))),
    doc(blockquote(p("a"), blockquote(p("b"), p("c")))),
    [
      { type: 2, parent: 0, index: 0, to: 1 },
      { type: 1, from: 10, index: 0 },
      { type: 1, from: 1, index: 1 },
      { type: 4, from: 9 },
    ]
  );
});

it("insert 2 leaves", () => {
  diffAndPatch(
    doc(p("a"), p("b"), p("c")),
    doc(hr(), p("a"), p("b"), p("c"), hr()),
    [
      { type: 2, index: 0, parent: 0, to: 1 },
      { type: 2, index: 4, parent: 0, to: 11 },
    ]
  );
});

it("delete 1 leaf", () => {
  diffAndPatch(doc(p("a", em("b"), "c")), doc(p("a", em("b"))), [
    { type: 4, from: 4 },
  ]);
});

it("update 1 leaf", () => {
  diffAndPatch(doc(p("a", em("b"), "c")), doc(p("a", em("b"), "cd")), [
    { type: 3, from: 4, to: 4 },
  ]);
});

it("replace 1 leaf", () => {
  diffAndPatch(doc(p("a", em("b"), "c")), doc(p("a", em("b"), "acb")), [
    { type: 2, index: 2, parent: 1, to: 4 },
    { type: 4, from: 4 },
  ]);
});

it("unwrap a sub-tree", () => {
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

  diffAndPatch(a, b, [
    { type: 1, index: 0, depth: 5 },
    { type: 4, from: 10 },
  ]);
});

it("an insertion interfered by another insertion", () => {
  const a = doc(p("a", em("b"), "c"));
  const b = doc(p("a", em("b"), "c", em("hello")), p("d"));

  diffAndPatch(a, b, [
    { type: 2, index: 1, parent: 0, depth: 1 },
    { type: 2, index: 3, parent: 1, depth: 2 },
    { type: 2, index: 0, depth: 2 },
  ]);
});

it("update a intra-moved sub-tree", () => {
  const a = doc(blockquote(p("b"), p("c"), p("d")), p("a"));
  const b = doc(p("a"), blockquote(p("b"), p("c"), p("dd")));

  diffAndPatch(a, b, [{ type: 1, parent: 0, index: 1 }, { type: 3 }]);
});

it("insert in a intra-moved sub-tree", () => {
  const a = doc(blockquote(p("b"), p("c")), p("a"));
  const b = doc(p("a"), blockquote(p("b"), p("c"), p("dd")));

  diffAndPatch(a, b, [
    { type: 1, parent: 0, index: 1 },
    { type: 2, depth: 2 },
    { type: 2, depth: 3 },
  ]);
});

it("move in a moved sub-tree", () => {
  const a = doc(
    ul(
      li(
        p("aaa"),
        p("xyz"),
        ul(li(p("bbb"), p("ccc"), p("ddd")), li(p("eee"), p("fff"), p("ggg")))
      )
    )
  );
  const b = doc(
    ul(
      li(
        p("xyz"),
        ul(li(p("bbb"), p("ccc"), p("ddd")), li(p("fff"), p("ggg"), p("eee"))),
        p("aaa")
      )
    )
  );

  diffAndPatch(a, b, [
    { type: 1, index: 2, depth: 3 },
    { type: 1, index: 2, depth: 5 },
  ]);
});

it("force patch", () => {
  const a = doc(
    p("- foo\n  - bar\n    - baz\n\n\n      bim\n  - xyz\n  - hhh")
  );
  const b = doc(
    ul(
      li(
        p(em("- "), "foo"),
        ul(
          li(
            p(em("  - "), "bar"),
            ul(
              li(
                p(em("    - "), "baz"),
                p(br()),
                p(br()),
                p(em("      "), "bim")
              )
            )
          ),
          li(p(em("  - "), "xyz")),
          li(p(em("  - "), "hhh"))
        )
      )
    )
  );

  diffAndPatch(a, b, null, 0, true);
});
