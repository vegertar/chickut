import Runtime, {
  Snippet,
  AmbiguousError,
  CycleError,
  toposort,
} from "./runtime";

function sleep(n: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, n);
  });
}

describe("compile", () => {
  const cases = [
    {
      code: `"counter" + x    `,
      vars: [],
      refs: [{ name: "x" }],
      tr: `;return "counter" + x    `,
    },
    {
      code: `"counter" + x  // comment`,
      vars: [],
      refs: [{ name: "x" }],
      tr: `;return "counter" + x  // comment`,
    },
    {
      code: `"counter" + x  /* comment */`,
      vars: [],
      refs: [{ name: "x" }],
      tr: `;return "counter" + x  /* comment */`,
    },
    {
      code: `\`counter: \${x} (\${y})\``,
      vars: [],
      refs: [{ name: "x" }, { name: "y" }],
      tr: `;return \`counter: \${x} (\${y})\``,
    },
    {
      code: "function getCounter() { return counter; }",
      vars: [{ name: "getCounter" }],
      refs: [{ name: "counter" }],
      tr:
        "function getCounter() { return counter; };__env__.getCounter = getCounter;",
    },
    {
      code: `a = b = c + d`,
      vars: [{ name: "a" }, { name: "b" }],
      refs: [{ name: "c" }, { name: "d" }],
      tr: `;return (__env__.a) = (__env__.b) = c + d`,
    },
    {
      code: `a = c + d; a + 1`,
      vars: [{ name: "a" }],
      refs: [{ name: "c" }, { name: "d" }, { name: "a", nesting: 0 }],
      tr: `(__env__.a) = c + d; ;return (__env__.a) + 1`,
    },
    {
      code: `x = {a, b: 1, [c]: "x"}`,
      vars: [{ name: "x" }],
      refs: [{ name: "a" }, { name: "c" }],
      tr: `;return (__env__.x) = {a, b: 1, [c]: "x"}`,
    },
    {
      code: `x = {[a]: a + 1, a: 2, b: 1 + d, [c]: "x", e: {f}}`,
      vars: [{ name: "x" }],
      refs: [
        { name: "a" },
        { name: "a" },
        { name: "d" },
        { name: "c" },
        { name: "f" },
      ],
      tr: `;return (__env__.x) = {[a]: a + 1, a: 2, b: 1 + d, [c]: "x", e: {f}}`,
    },
    {
      code: "<>{x}</>",
      vars: [],
      refs: [
        { name: "", jsx: "JSXOpeningFragment" },
        { name: "", jsx: "JSXChild" },
        { name: "", jsx: "JSXExpressionContainer" },
        { name: "x" },
        { name: "", jsx: "JSXClosingFragment" },
      ],
      tr: ";return React.createElement(React.Fragment, null, x)",
    },
    {
      code: "<>hello, {x}</>",
      vars: [],
      refs: [
        { name: "", jsx: "JSXOpeningFragment" },
        { name: "", jsx: "JSXChild" },
        { name: "", jsx: "JSXText" },
        { name: "", jsx: "JSXChild" },
        { name: "", jsx: "JSXExpressionContainer" },
        { name: "x" },
        { name: "", jsx: "JSXClosingFragment" },
      ],
      tr: ";return React.createElement(React.Fragment, null, 'hello, ', x)",
    },
    {
      code: "<>{...x}</>",
      vars: [],
      refs: [
        { name: "", jsx: "JSXOpeningFragment" },
        { name: "", jsx: "JSXChild" },
        { name: "", jsx: "JSXSpreadChild" },
        { name: "x" },
        { name: "", jsx: "JSXClosingFragment" },
      ],
      tr: ";return React.createElement(React.Fragment, null, ...x)",
    },
    {
      code: "<Hello a={x + y} b='x'>x {...x}</Hello>",
      vars: [],
      refs: [
        { name: "", jsx: "JSXOpeningElement" }, // <
        { name: "Hello" },
        { name: "", jsx: "JSXAttribute" }, // a={x + y}
        { name: "", jsx: "JSXIdentifier" }, // a
        { name: "", jsx: "JSXExpressionContainer" },
        { name: "x" },
        { name: "y" },
        { name: "", jsx: "JSXAttribute" }, // b='x'
        { name: "", jsx: "JSXIdentifier" }, // b

        { name: "", jsx: "JSXChild" },
        { name: "", jsx: "JSXText" }, // 'x '
        { name: "", jsx: "JSXChild" },
        { name: "", jsx: "JSXSpreadChild" }, // {...x}
        { name: "x" },
        { name: "", jsx: "JSXClosingElement" },
      ],
      tr:
        ";return React.createElement(Hello, {'a': x + y, 'b': 'x'}, 'x ', ...x)",
    },
    {
      code: "<><span x-x={{a, b:1, [c]:d}}>{x}</span></>",
      vars: [],
      refs: [
        { name: "", jsx: "JSXOpeningFragment" },
        { name: "", jsx: "JSXChild" },
        { name: "", jsx: "JSXOpeningElement" },
        { name: "", jsx: "JSXIdentifier" }, // span
        { name: "", jsx: "JSXAttribute" }, // x-x={{a, b:1, [c]:d}}
        { name: "", jsx: "JSXIdentifier" }, // x-x=
        { name: "", jsx: "JSXExpressionContainer" }, // {{a, b:1, [c]:d}}
        { name: "a" },
        { name: "c" },
        { name: "d" },

        { name: "", jsx: "JSXChild" },
        { name: "", jsx: "JSXExpressionContainer" },
        { name: "x" },
        { name: "", jsx: "JSXClosingElement" },
        { name: "", jsx: "JSXClosingFragment" },
      ],
      tr:
        ";return React.createElement(React.Fragment, null, React.createElement('span', {'x-x': {a, b:1, [c]:d}}, x))",
    },
  ];

  cases.forEach(({ code, vars, refs, tr }, i) =>
    it(code, () => {
      const r = new Snippet(code, `${i}`);
      expect(r.vars).toMatchObject(vars);
      expect(r.refs).toMatchObject(refs);
      expect(r.transform()).toBe(tr);
    })
  );
});

describe("the minimal snippet", () => {
  const cases = [
    {
      code: `console.log(x, a)`,
      vars: [],
      refs: [{ name: "console" }, { name: "x" }, { name: "a" }],
      tr: `;return console.log(x, a)`,
    },
    {
      code: `var x = 0; setInterval(() => x += z, 1000)`,
      vars: [{ name: "x" }],
      refs: [{ name: "setInterval" }, { name: "x", nesting: 0 }, { name: "z" }],
      tr: `var x = 0;;__env__.x = x; ;return setInterval(() => (__env__.x) += z, 1000)`,
    },
    {
      code: `const y = x + 1; y`,
      vars: [{ name: "y" }],
      refs: [{ name: "x" }, { name: "y", nesting: 0 }],
      tr: `const y = x + 1;;__env__.y = y; ;return (__env__.y)`,
    },
    {
      code: `let z = 0, a = 0, b = 0; const id = setInterval(() => ++a, 1000); () => { clearInterval(id); ++z; }`,
      vars: [{ name: "z" }, { name: "a" }, { name: "b" }, { name: "id" }],
      refs: [
        { name: "setInterval" },
        { name: "a", nesting: 0 },
        { name: "clearInterval" },
        { name: "id", nesting: 0 },
        { name: "z", nesting: 0 },
      ],
      tr: `let z = 0, a = 0, b = 0;;__env__.b = b;;__env__.a = a;;__env__.z = z; const id = setInterval(() => ++(__env__.a), 1000);;__env__.id = id; ;return () => { clearInterval((__env__.id)); ++(__env__.z); }`,
    },
    {
      code: `const y = x - 1; y`,
      vars: [{ name: "y" }],
      refs: [{ name: "x" }, { name: "y", nesting: 0 }],
      tr: `const y = x - 1;;__env__.y = y; ;return (__env__.y)`,
    },
    {
      code: `console.log()`,
      vars: [],
      refs: [{ name: "console" }],
      tr: `;return console.log()`,
    },
  ];

  cases.forEach(({ code, vars, refs, tr }, i) =>
    it(code, () => {
      const r = new Snippet(code, `${i}`);
      expect(r.refs).toMatchObject(refs);
      expect(r.vars).toMatchObject(vars);
      expect(r.transform()).toBe(tr);
    })
  );

  it("toposort", () => {
    const source = cases.map((item, i) => new Snippet(item.code, `${i}`));
    const output = toposort(source);
    expect(output).toMatchObject([
      { name: "z", from: new Set(["3"]), to: new Set(["1"]) },
      { name: "x", from: new Set(["1"]), to: new Set(["0", "2", "4"]) },
      { name: "a", from: new Set(["3"]), to: new Set(["0"]) },
      { name: "1", from: new Set(["0"]), to: new Set() },
      { name: "2", from: new Set(["5"]), to: new Set() },
      { name: "y", from: new Set(["2", "4"]), to: new Set() },
      { name: "b", from: new Set(["3"]), to: new Set([]) },
      { name: "id", from: new Set(["3"]), to: new Set([]) },
    ]);
  });

  it("functions", async () => {
    const runtime = new Runtime(cases.map((item) => item.code));
    const [f1, f2, f3, f4, f5] = Object.values(runtime.state.closures).map(
      (item) => item.fn!
    );

    expect(f1(undefined, {}, 1, 2)).toBeUndefined();

    const env2 = { x: undefined };
    const ret2 = f2(env2, {}, 1);
    expect(typeof ret2).toBe("number");
    expect(env2.x).toBe(0);
    await sleep(1500);
    clearInterval(ret2);
    expect(env2.x).toBe(1);

    const env3 = { y: undefined };
    const ret3 = f3(env3, {}, 10);
    expect(env3.y).toBe(ret3);
    expect(ret3).toBe(11);

    const env4 = { z: undefined, a: undefined };
    const ret4 = f4(env4, {});
    expect(typeof ret4).toBe("function");
    expect(env4.z).toBe(0);
    await sleep(1500);
    clearInterval(ret4);
    expect(env4.a).toBe(1);

    const env5 = { y: undefined };
    const ret5 = f5(env5, {}, 10);
    expect(env5.y).toBe(ret5);
    expect(ret5).toBe(9);
  });

  it("evaluate", async () => {
    const runtime = new Runtime(cases.map((item) => item.code));
    await sleep(3000);
    runtime.dispose();

    const [c1, c2, c3, c4, c5] = Object.values(runtime.state.closures);

    expect(c1.result!.value).toBeUndefined();
    expect(c1.env).toMatchObject({});
    expect(c1.params).toMatchObject(["x", "a"]);

    expect(typeof c2.result!.value).toBe("number");
    expect(c2.env).toMatchObject({ x: 0 });
    expect(c2.params).toMatchObject(["z"]);

    expect(c3.result!.value).toBe(1);
    expect(c3.env).toMatchObject({ y: 1 });
    expect(c3.params).toMatchObject(["x"]);

    expect(c4.result).toBeNull();
    expect(c4.env).toMatchObject({ z: 1, a: 2, b: 0 });
    expect(c4.params).toMatchObject([]);

    expect(c5.result!.value).toBe(-1);
    expect(c5.env).toMatchObject({ y: -1 });
    expect(c5.params).toMatchObject(["x"]);
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

  case1.forEach(({ code, vars, refs }, i) =>
    it(code, () => {
      const r = new Snippet(code, `${i}`);
      expect(r.refs).toMatchObject(refs);
      expect(r.vars).toMatchObject(vars);
    })
  );

  it("got cycle", () => {
    const source = case1.map((item, i) => new Snippet(item.code, `${i}`));
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

  case1.forEach(({ code, vars, refs }, i) =>
    it(code, () => {
      const r = new Snippet(code, `${i}`);
      expect(r.refs).toMatchObject(refs);
      expect(r.vars).toMatchObject(vars);
    })
  );

  it("got ambigous name", () => {
    const source = case1.map((item, i) => new Snippet(item.code, `${i}`));
    expect(() => toposort(source)).toThrowError(AmbiguousError);
  });
});
