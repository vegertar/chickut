import Runtime, {
  Snippet,
  AmbiguousError,
  CycleError,
  toposort,
} from "./runtime";

describe("the minimal snippet", () => {
  const cases = [
    {
      code: `console.log(x, a)`,
      vars: [],
      refs: [{ name: "console" }, { name: "x" }, { name: "a" }],
      tr: `console.log(x, a)`,
    },
    {
      code: `var x = 0; setInterval(() => ++x + z++, 5000)`,
      vars: [{ name: "x" }],
      refs: [{ name: "setInterval" }, { name: "x", nesting: 0 }, { name: "z" }],
      tr: `var x = 0;;__runtime__.x = x; setInterval(() => ++(__runtime__.x) + z++, 5000)`,
    },
    {
      code: `const y = x + 1;`,
      vars: [{ name: "y" }],
      refs: [{ name: "x" }],
      tr: `const y = x + 1;;__runtime__.y = y;`,
    },
    {
      code: `let z = 0, a; setInterval(() => ++a, 1000)`,
      vars: [{ name: "z" }, { name: "a" }],
      refs: [{ name: "setInterval" }, { name: "a", nesting: 0 }],
      tr: `let z = 0, a;;__runtime__.z = z;;__runtime__.a = a; setInterval(() => ++(__runtime__.a), 1000)`,
    },
  ];

  cases.forEach(({ code, vars, refs, tr }) =>
    it(code, () => {
      const r = new Snippet(code);
      expect(r.refs).toMatchObject(refs);
      expect(r.vars).toMatchObject(vars);
      expect(r.transform()).toBe(tr);
    })
  );

  it("toposort", () => {
    const source = cases.map((item) => new Snippet(item.code));
    const output = toposort(source);
    expect(output).toMatchObject([
      { name: "z", from: [3], to: [1] },
      { name: "x", from: [1], to: [0, 2] },
      { name: "a", from: [3], to: [0] },
      { name: "", from: [0], to: [] },
      { name: "y", from: [2], to: [] },
    ]);
  });

  it("run", () => {
    // const runtime = new Runtime(cases.map((item) => item.code));
    // runtime.run();
  });
});

describe("detect cycle", () => {
  const case1 = [
    {
      code: `let x; console.log(x, a)`,
      vars: [{ name: "x" }],
      refs: [{ name: "console" }, { name: "x", nesting: 0 }, { name: "a" }],
    },
    {
      code: `let a; console.log(x, a)`,
      vars: [{ name: "a" }],
      refs: [{ name: "console" }, { name: "x" }, { name: "a", nesting: 0 }],
    },
  ];

  case1.forEach(({ code, vars, refs }) =>
    it(code, () => {
      const r = new Snippet(code);
      expect(r.refs).toMatchObject(refs);
      expect(r.vars).toMatchObject(vars);
    })
  );

  it("got cycle", () => {
    const source = case1.map((item) => new Snippet(item.code));
    expect(() => toposort(source)).toThrowError(CycleError);
  });
});

describe("detect ambiguous name", () => {
  const case1 = [
    {
      code: `let x; console.log(x, a)`,
      vars: [{ name: "x" }],
      refs: [{ name: "console" }, { name: "x", nesting: 0 }, { name: "a" }],
    },
    {
      code: `let x; ++x`,
      vars: [{ name: "x" }],
      refs: [{ name: "x", nesting: 0 }],
    },
    {
      code: `console.log(x)`,
      vars: [],
      refs: [{ name: "console" }, { name: "x" }],
    },
  ];

  case1.forEach(({ code, vars, refs }) =>
    it(code, () => {
      const r = new Snippet(code);
      expect(r.refs).toMatchObject(refs);
      expect(r.vars).toMatchObject(vars);
    })
  );

  it("got ambigous name", () => {
    const source = case1.map((item) => new Snippet(item.code));
    expect(() => toposort(source)).toThrowError(AmbiguousError);
  });
});
