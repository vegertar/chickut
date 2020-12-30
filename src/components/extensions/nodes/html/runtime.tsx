import { parseModule, ESTree } from "meriyah";

type ESTreeNodeType = ESTree.Node["type"] | ESTree.Expression["type"];
type Evaluators = Partial<Record<ESTreeNodeType, (x: ESTree.Node) => void>>;

const frame =
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : setImmediate;

export class Snippet {
  private nesting = 0;

  public readonly refs: {
    name: string;
    nesting?: number; // undefined nesting means this is an forign reference
    range?: [number, number] | null;
  }[] = [];

  public readonly vars: {
    kind: "var" | "let" | "const";
    name: string;
    nesting: number;
    range?: [number, number] | null;
  }[] = [];

  readonly evaluators: Evaluators = {
    Identifier: (node: ESTree.Node) => {
      const { name, range } = node as ESTree.Identifier;
      const last = this.vars[this.vars.length - 1];
      if (last && !last.name) {
        last.name = name;
      } else {
        let i = this.vars.length - 1;
        let j: number | undefined;
        for (; i >= 0 && this.vars[i].nesting === this.nesting; --i) {
          if (this.vars[i].name === name) {
            // found on the same scope
            j = i;
            break;
          }
        }

        if (j === undefined) {
          for (; i >= 0 && this.vars[i].nesting < this.nesting; --i) {
            if (this.vars[i].name === name) {
              // found on the up scope
              j = i;
              break;
            }
          }
        }

        this.refs.push({
          name,
          range,
          nesting: j !== undefined ? this.vars[j].nesting : undefined,
        });
      }
    },

    BinaryExpression: (node: ESTree.Node) => {
      const { left, right } = node as ESTree.BinaryExpression;
      this.evaluators[left.type]?.(left);
      this.evaluators[right.type]?.(right);
    },

    MemberExpression: (node: ESTree.Node) => {
      const { object } = node as ESTree.MemberExpression;
      this.evaluators[object.type]?.(object);
    },

    CallExpression: (node: ESTree.Node) => {
      const { callee, arguments: params } = node as ESTree.CallExpression;
      this.evaluators[callee.type as ESTreeNodeType]?.(callee);
      for (const param of params) {
        this.evaluators[param.type]?.(param);
      }
    },

    UpdateExpression: (node: ESTree.Node) => {
      const { argument: param } = node as ESTree.UpdateExpression;
      this.evaluators[param.type]?.(param);
    },

    ArrowFunctionExpression: (node: ESTree.Node) => {
      const { params, body } = node as ESTree.ArrowFunctionExpression;
      this.nesting++;
      for (const param of params) {
        this.vars.push({
          kind: "let",
          nesting: this.nesting,
          name: "",
        });
        this.evaluators[param.type]?.(param);
      }
      this.evaluators[body.type]?.(body);
      this.nesting--;
    },

    VariableDeclarator: (node: ESTree.Node) => {
      const { id, init } = node as ESTree.VariableDeclarator;
      this.evaluators[id.type]?.(id);
      init && this.evaluators[init.type]?.(init);
    },

    VariableDeclaration: (node: ESTree.Node) => {
      const { kind, declarations, range } = node as ESTree.VariableDeclaration;
      for (const item of declarations) {
        this.vars.push({
          name: "",
          kind: kind,
          nesting: this.nesting,
          range,
        });
        this.evaluators[item.type]?.(item);
      }
    },

    ExpressionStatement: (node: ESTree.Node) => {
      const { expression } = node as ESTree.ExpressionStatement;
      this.evaluators[expression.type]?.(expression);
    },

    BlockStatement: (node: ESTree.Node) => {
      const block = node as ESTree.BlockStatement;
      this.nesting += 1;
      for (const item of block.body) {
        this.evaluators[item.type]?.(item);
      }
      this.nesting -= 1;
    },

    ArrayPattern: (node: ESTree.Node) => {
      const { elements } = node as ESTree.ArrayPattern;
      const last = this.vars[this.vars.length - 1];
      const declaring = last && !last.name;
      if (declaring && !elements.length) {
        this.vars.pop();
      }
      for (const element of elements) {
        if (declaring && last.name) {
          this.vars.push({ ...last, name: "" });
        }
        this.evaluators[element.type]?.(element);
      }
    },
  };

  constructor(public readonly code: string) {
    const program = parseModule(code, {
      lexical: true,
      ranges: true,
    });
    program.body.forEach((node) => {
      this.evaluators[node.type]?.(node);
    });
  }

  transform() {
    // TODO: eslint-disable-next-line no-new-func
    type Item = {
      name: string;
      kind?: string; // for undefined kind which means a decleration
      nesting?: number;
      range?: [number, number] | null;
    };
    const items: Item[] = [...this.vars, ...this.refs];
    items.sort((a, b) => {
      if (!a.range || !b.range) {
        throw new Error(`Should enable index-based range feature`);
      }

      return a.range[0] - b.range[0];
    });

    const pieces: string[] = [];
    let last = 0;

    for (const item of items) {
      if (!item.range) {
        throw new Error(`Should enable index-based range feature`);
      }

      if (!item.kind && item.nesting === 0) {
        pieces.push(this.code.slice(last, item.range[0]));
        pieces.push(
          `(__runtime__.${this.code.slice(item.range[0], item.range[1])})`
        );
      } else {
        pieces.push(this.code.slice(last, item.range[1]));
        if (item.kind && item.nesting === 0) {
          pieces.push(`;__runtime__.${item.name} = ${item.name};`);
        }
      }
      if (last < item.range[1]) {
        last = item.range[1];
      }
    }
    pieces.push(this.code.slice(last));
    return pieces.join("");
  }
}

type Input = Record<string, number[]>;
type Output = { name: string; from: number[]; to: number[] }[];
type Visited = Record<string, undefined | 1 | 2>;

export class CycleError extends Error {}
export class AmbiguousError extends Error {}

function dfs(
  source: Snippet[],
  name: string,
  visited: Visited,
  input: Input,
  output: Output
) {
  const status = visited[name];
  if (status === 1) {
    // is not a DAG
    throw new CycleError(name);
  }

  if (!status) {
    visited[name] = 1;
    const from = input[name];

    for (const { refs } of from.map((i) => source[i])) {
      for (const r of refs) {
        if (r.nesting !== undefined) {
          continue;
        }
        switch (input[r.name]?.length || 0) {
          case 0:
            break;
          case 1:
            const index = output.length;
            dfs(source, r.name, visited, input, output);

            let j: number | undefined;
            if (index === output.length) {
              for (let i = index - 1; i >= 0; --i) {
                if (output[i].name === r.name) {
                  j = i;
                  break;
                }
              }
            } else {
              for (let i = index; i < output.length; ++i) {
                if (output[i].name === r.name) {
                  j = i;
                  break;
                }
              }
            }

            if (j !== undefined) {
              output[j].to.push(...from);
            }
            break;
          default:
            throw new AmbiguousError(r.name);
        }
      }
    }

    visited[name] = 2;
    output.push({ name, from, to: [] });
  }
}

export function toposort(source: Snippet[]) {
  const input = source.reduce((all, item, index) => {
    if (item.vars.length) {
      for (const { name, nesting } of item.vars) {
        if (name && nesting === 0) {
          if (!all[name]) {
            all[name] = [];
          }
          all[name].push(index);
        }
      }
    } else {
      if (!all[""]) {
        all[""] = [];
      }
      all[""].push(index);
    }
    return all;
  }, {} as Input);

  const output: Output = [];
  const visited: Visited = {};
  for (const name in input) {
    if (!visited[name]) {
      dfs(source, name, visited, input, output);
    }
  }

  return output;
}

type Graph = (Output[0] & {
  oldValue?: any;
  newValue?: any;
  ranTimes?: number;
})[];

export default class Runtime {
  public readonly snippets: Snippet[];
  public readonly graph: Graph;

  constructor(codes: string[]) {
    this.snippets = codes.map((code) => new Snippet(code));
    this.graph = toposort(this.snippets);
  }

  run() {
    console.log(this.graph);
  }
}
