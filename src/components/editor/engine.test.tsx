import Engine, { BlockRule } from "./engine";

const t = new Engine();

const p: BlockRule = {
  match: /(?<content>.*)/,
};

const ul: BlockRule = {
  match: /^ {0,3}(?:[-+*])\s+(?<content>.*)/,
  contentTag: "li",
};

const h: BlockRule = {
  match: /^ {0,3}(?<markup>#{1,6}) +(?<content>.*)/,
  attrs: (matched: string[]) => ({ level: matched[1].length }),
};

describe("paragraph", () => {
  beforeAll(() => {
    t.reset().block.insert("p", p);
  });

  it("parse multiple lines", () => {
    expect(t.parse("hello\nworld")).toMatchObject([
      { type: "open", tag: "p", level: 0 },
      {
        type: "inline",
        tag: "",
        level: 1,
        content: "hello",
        children: [{ type: "text", tag: "", level: 0, content: "hello" }],
      },
      { type: "close", tag: "p", level: 0 },
      { type: "open", tag: "p", level: 0 },
      {
        type: "inline",
        tag: "",
        level: 1,
        content: "world",
        children: [{ type: "text", tag: "", level: 0, content: "world" }],
      },
      { type: "close", tag: "p", level: 0 },
    ]);
  });
});

describe("bulletedlist", () => {
  beforeAll(() => {
    t.reset().block.insert("ul", ul).insert("p", p);
  });

  const threeRowList = `- the first line
  - the second line
  - the third line`;

  it("parse three-row list", () => {
    expect(t.parse(threeRowList)).toMatchObject([
      { type: "open", tag: "ul", level: 0, nesting: 1 },
      {
        type: "block",
        tag: "li",
        level: 1,
        nesting: 0,
        children: [
          { type: "open", tag: "p" },
          { type: "inline", tag: "", content: "the first line" },
          { type: "close", tag: "p" },
        ],
      },
      {
        type: "block",
        tag: "li",
        level: 1,
        nesting: 0,
        children: [
          { type: "open", tag: "p" },
          { type: "inline", tag: "", content: "the second line" },
          { type: "close", tag: "p" },
        ],
      },
      {
        type: "block",
        tag: "li",
        level: 1,
        nesting: 0,
        children: [
          { type: "open", tag: "p" },
          { type: "inline", tag: "", content: "the third line" },
          { type: "close", tag: "p" },
        ],
      },
      { type: "close", tag: "ul", level: 0, nesting: -1 },
    ]);
  });

  it("expand parsed three-row list", () => {
    expect(t.expand(t.parse(threeRowList))).toMatchObject([
      { type: "open", tag: "ul", level: 0, nesting: 1 },

      { type: "open", tag: "li", level: 1, nesting: 1 },
      { type: "open", tag: "p", level: 2, nesting: 1 },
      {
        type: "inline",
        tag: "",
        content: "the first line",
        level: 3,
        nesting: 0,
      },
      { type: "close", tag: "p", level: 2, nesting: -1 },
      { type: "close", tag: "li", level: 1, nesting: -1 },

      { type: "open", tag: "li", level: 1, nesting: 1 },
      { type: "open", tag: "p", level: 2, nesting: 1 },
      {
        type: "inline",
        tag: "",
        content: "the second line",
        level: 3,
        nesting: 0,
      },
      { type: "close", tag: "p", level: 2, nesting: -1 },
      { type: "close", tag: "li", level: 1, nesting: -1 },

      { type: "open", tag: "li", level: 1, nesting: 1 },
      { type: "open", tag: "p", level: 2, nesting: 1 },
      {
        type: "inline",
        tag: "",
        content: "the third line",
        level: 3,
        nesting: 0,
      },
      { type: "close", tag: "p", level: 2, nesting: -1 },
      { type: "close", tag: "li", level: 1, nesting: -1 },

      { type: "close", tag: "ul", level: 0, nesting: -1 },
    ]);
  });

  const nestedList = `+ Create a list by starting a line with +, -, or *
+ Sub-lists are made by indenting 2 spaces:
  - Marker character change forces new list start:
    * Ac tristique libero volutpat at
    + Facilisis in pretium nisl aliquet
    - Nulla volutpat aliquam velit
+ Very easy!`;

  it("parse nested list", () => {
    console.log(t.parse(nestedList));
  });
});

describe("heading", () => {
  beforeAll(() => {
    t.reset().block.insert("h", h).insert("p", p);
  });

  for (let i = 1; i <= 6; ++i) {
    it(`h${i}`, () => {
      expect(t.parse(`${"#".repeat(i)} h${i}`)).toMatchObject([
        { type: "open", tag: "h", attrs: { level: i } },
        { type: "inline", tag: "", content: `h${i}` },
        { type: "close", tag: "h" },
      ]);
    });
  }

  it("multiple headings", () => {
    expect(
      t.parse(`# h1
## h2
foo
### h3
bar
#### h4
#not h1
    ## not h2`)
    ).toMatchObject([
      { type: "open", tag: "h", attrs: { level: 1 } },
      { type: "inline", tag: "", content: "h1" },
      { type: "close", tag: "h" },

      { type: "open", tag: "h", attrs: { level: 2 } },
      { type: "inline", tag: "", content: "h2" },
      { type: "close", tag: "h" },

      { type: "open", tag: "p" },
      { type: "inline", tag: "", content: "foo" },
      { type: "close", tag: "p" },

      { type: "open", tag: "h", attrs: { level: 3 } },
      { type: "inline", tag: "", content: "h3" },
      { type: "close", tag: "h" },

      { type: "open", tag: "p" },
      { type: "inline", tag: "", content: "bar" },
      { type: "close", tag: "p" },

      { type: "open", tag: "h", attrs: { level: 4 } },
      { type: "inline", tag: "", content: "h4" },
      { type: "close", tag: "h" },

      { type: "open", tag: "p" },
      { type: "inline", tag: "", content: "#not h1" },
      { type: "close", tag: "p" },

      { type: "open", tag: "p" },
      { type: "inline", tag: "", content: "    ## not h2" },
      { type: "close", tag: "p" },
    ]);
  });

  it("expand", () => {
    const tokens = t.parse("# h1\nw");
    expect(t.expand(tokens)).toMatchObject(tokens);
  });
});
