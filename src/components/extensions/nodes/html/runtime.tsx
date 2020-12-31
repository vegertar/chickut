import { parseModule, ESTree } from "meriyah";
import { formatDiagnostic } from "typescript";

type ESTreeNodeType = ESTree.Node["type"] | ESTree.Expression["type"];
type Evaluators = Partial<Record<ESTreeNodeType, (x: ESTree.Node) => void>>;

const frame =
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : setImmediate;

type Range = [number, number] | null;

type TransformItem = {
  name: string;
  kind?: string; // for undefined kind which means a decleration
  nesting?: number;
  range?: [number, number] | null;
};

export class Snippet {
  private range?: Range;
  private lastExpression?: Range;
  private nesting = 0;

  public readonly refs: {
    name: string;
    nesting?: number; // undefined nesting means this is an forign reference
    range?: Range;
  }[] = [];

  public readonly vars: {
    kind: "var" | "let" | "const";
    name: string;
    nesting: number;
    range?: Range;
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

    AssignmentExpression: (node: ESTree.Node) => {
      const { left, right } = node as ESTree.AssignmentExpression;
      this.evaluators[left.type]?.(left);
      this.evaluators[right.type]?.(right);
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
      const { expression, range } = node as ESTree.ExpressionStatement;
      this.evaluators[expression.type]?.(expression);
      if (range && this.range && range[1] === this.range[1]) {
        this.lastExpression = range;
      }
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
    this.range = program.range;
    program.body.forEach((node) => {
      this.evaluators[node.type]?.(node);
    });
  }

  private transformItem(
    pieces: string[],
    items: TransformItem[],
    itemIndex: number,
    codeIndex: number,
    codeUntil = Infinity
  ) {
    if (codeIndex > codeUntil) {
      throw new Error(`Invalid code index: ${codeIndex} > ${codeUntil}`);
    }

    const item = items[itemIndex];
    if (!item.range) {
      throw new Error(`Should enable index-based range feature`);
    }

    const [itemStart, itemEnd] = item.range;

    if (codeIndex >= itemEnd) {
      return codeIndex;
    }

    if (codeUntil <= itemStart) {
      pieces.push(this.code.slice(codeIndex, codeUntil));
      return codeUntil;
    }

    codeIndex = this.transformReturn(pieces, codeIndex, itemStart);

    if (codeIndex < itemStart) {
      pieces.push(this.code.slice(codeIndex, itemStart));
      codeIndex = itemStart;
    }

    if (codeUntil < itemEnd) {
      return codeIndex;
    }

    if (!item.kind && item.nesting === 0) {
      pieces.push(`(__env__.${this.code.slice(itemStart, itemEnd)})`);
    } else {
      // the itemEnd might be greater than the next itemStarts
      for (
        let i = itemIndex + 1;
        i < items.length && codeIndex < itemEnd;
        ++i
      ) {
        codeIndex = this.transformItem(pieces, items, i, codeIndex, itemEnd);
      }
      pieces.push(this.code.slice(codeIndex, itemEnd));
      if (item.kind && item.nesting === 0) {
        pieces.push(`;__env__.${item.name} = ${item.name};`);
      }
    }

    if (codeIndex < itemEnd) {
      codeIndex = itemEnd;
    }

    return codeIndex;
  }

  private transformReturn(
    pieces: string[],
    last: number,
    itemStart = Infinity
  ) {
    const start = this.lastExpression?.[0];
    if (start !== undefined && last <= start && start <= itemStart) {
      pieces.push(this.code.slice(last, start), ";return ");
      last = start;
    }
    return last;
  }

  transform() {
    const items: TransformItem[] = [...this.vars, ...this.refs];
    items.sort((a, b) => {
      if (!a.range || !b.range) {
        throw new Error(`Should enable index-based range feature`);
      }

      return a.range[0] - b.range[0];
    });

    const pieces: string[] = [];

    let last = 0;
    for (let i = 0; i < items.length; ++i) {
      last = this.transformItem(pieces, items, i, last);
    }

    last = this.transformReturn(pieces, last);
    pieces.push(this.code.slice(last));
    return pieces.join("");
  }
}

// the records of global variables for each sneppet
type Records = Record<string, number[]>;
// the DAG graph
type Topo = { name: string; from: Set<number>; to: Set<number> }[];
// track DFS status
type Visited = Record<string, undefined | 1 | 2>;

export class CycleError extends Error {}
export class AmbiguousError extends Error {}

function dfs(
  source: Snippet[],
  name: string,
  visited: Visited,
  input: Records,
  output: Topo
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
        // discards internal references
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
              for (const i of from) {
                output[j].to.add(i);
              }
            }
            break;
          default:
            throw new AmbiguousError(r.name);
        }
      }
    }

    visited[name] = 2;
    output.push({ name, from: new Set(from), to: new Set() });
  }
}

export function toposort(source: Snippet[]) {
  const input = source.reduce((all, item, index) => {
    if (item.vars.length) {
      for (const { name, nesting } of item.vars) {
        // only use global variables
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
  }, {} as Records);

  const output: Topo = [];
  const visited: Visited = {};
  for (const name in input) {
    if (!visited[name]) {
      dfs(source, name, visited, input, output);
    }
  }

  return output;
}

type Closure = {
  index: number;
  env: Record<string, any>;
  params: string[];
  timestamp: number;
  result?: any;
};

type Options = {
  onReturned?: (closure: Closure) => void;
  onDisposed?: (closure: Closure) => void;
};

export default class Runtime {
  public readonly options: Options;
  public readonly snippets: Snippet[];
  public readonly topo: Topo;
  public readonly closures: Closure[];
  public readonly functions: Function[];
  public readonly graph: Map<string, ((values: any[]) => any)[]>;

  private disposed = false;

  constructor(codes: string[], options?: Options) {
    this.options = { ...options };
    this.snippets = codes.map((code) => new Snippet(code));
    this.topo = toposort(this.snippets);

    this.closures = [];
    this.functions = this.snippets.map((snippet, i) => {
      const env: Record<string, any> = {};
      const params: string[] = [];
      this.topo.forEach(({ name, from, to }) => {
        if (from.has(i)) {
          env[name] = undefined;
        }
        if (to.has(i)) {
          params.push(name);
        }
      });

      this.closures.push({
        index: i,
        env: this.proxy(env, i),
        params,
        timestamp: 0,
      });
      // eslint-disable-next-line no-new-func
      return new Function("__env__", ...params, snippet.transform());
    });

    this.graph = this.createGraph();
  }

  private createGraph() {
    const graph: Map<string, ((values: any[]) => any)[]> = new Map();
    this.topo.forEach(({ name, to }, i) => {
      if (to.size === 0) {
        return;
      }

      const handlers: ((values: any[]) => any)[] = [];
      for (const target of to) {
        const fn = this.functions[target];
        const closure = this.closures[target];
        const { env, params } = closure;
        const others = new Set<number>();
        for (let j = 0; j < this.topo.length; ++j) {
          if (j !== i && this.topo[j].to.has(target)) {
            let ts = -1;
            let other: number | undefined;
            for (const index of this.topo[j].from) {
              const obj = this.closures[index];
              if (obj.timestamp > ts) {
                other = index;
                ts = obj.timestamp;
              }
            }
            if (other !== undefined) {
              others.add(other);
            }
          }
        }

        const args = new Map<string, Closure>();
        if (others.size) {
          for (let i = 0; i < params.length; ++i) {
            const param = params[i];
            for (const j of others) {
              const other = this.closures[j];
              if (Object.getOwnPropertyDescriptor(other.env, param)) {
                args.set(param, other);
                break;
              }
            }
          }
        }

        handlers.push((values: any[]) => {
          if (args.size) {
            for (let i = 0; i < params.length; ++i) {
              const param = params[i];
              const paramClosure = args.get(param);
              if (paramClosure) {
                values[i] = paramClosure.env[param];
              }
            }
          }

          this.cleanup(closure);
          closure.result = fn(env, ...values);
          this.options.onReturned?.(closure);
        });
      }

      if (handlers.length) {
        graph.set(name, handlers);
      }
    });

    return graph;
  }

  private cleanup(closure: Closure) {
    if (typeof closure.result === "function") {
      closure.result();
      closure.result = undefined;
      this.options.onDisposed?.(closure);
    }
  }

  private proxy(env: Record<string, any>, index: number) {
    return new Proxy(env, {
      set: (target, key, value, receiver) => {
        if (value === target[key as string]) {
          return false;
        }

        const ret = Reflect.set(target, key, value, receiver);
        if (ret) {
          this.closures[index].timestamp = new Date().getTime();
          if (!this.disposed) {
            const handlers = this.graph.get(key as string);
            handlers?.forEach((fn) => frame(() => fn(Object.values(target))));
          }
        }

        return ret;
      },
    });
  }

  evaluate() {
    if (this.disposed) {
      return false;
    }

    const done = new Set<number>();
    this.topo.forEach(({ from, to }) => {
      for (const i of from) {
        if (!done.has(i)) {
          done.add(i);
          const fn = this.functions[i];
          const closure = this.closures[i];
          frame(() => {
            closure.result = fn(closure.env);
            this.options.onReturned?.(closure);
          });
        }
      }
      // will be automatically ran by functions within from
      for (const i of to) {
        done.add(i);
      }
    });

    return true;
  }

  dispose() {
    this.disposed = true;
    for (let i = this.topo.length - 1; i >= 0; --i) {
      for (const j of this.topo[i].from) {
        this.cleanup(this.closures[j]);
      }
    }
  }
}
