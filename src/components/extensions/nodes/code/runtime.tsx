import { parseModule, ESTree } from "meriyah";
import isEqualWith from "lodash.isequalwith";

type ESTreeNodeType = ESTree.Node["type"] | ESTree.Expression["type"];
type Evaluators = Partial<Record<ESTreeNodeType, (x: ESTree.Node) => void>>;

const nop = () => {};
const ws = /^\s+$/;
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
      if (
        range &&
        this.range &&
        (range[1] === this.range[1] || ws.test(this.code.slice(range[1])))
      ) {
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

  constructor(public readonly code: string, public readonly id: string) {
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
type Records = Record<string, string[]>;
// the DAG graph
type Topo = { name: string; from: Set<string>; to: Set<string> }[];
// track DFS status
type Visited = Record<string, undefined | 1 | 2>;

export class CycleError extends Error {}
export class AmbiguousError extends Error {}

function dfs(
  source: Map<string, Snippet>,
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

    for (const { refs } of from.map((id) => source.get(id)!)) {
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

export function toposort(source: Map<string, Snippet> | Snippet[]) {
  if (Array.isArray(source)) {
    source = new Map(source.map((item) => [item.id, item]));
  }

  const input: Records = {};
  source.forEach((item, key) => {
    if (item.vars.length) {
      for (const { name, nesting } of item.vars) {
        // only use global variables
        if (name && nesting === 0) {
          if (!input[name]) {
            input[name] = [];
          }
          input[name].push(key);
        }
      }
    } else {
      if (!input[""]) {
        input[""] = [];
      }
      input[""].push(key);
    }
  });

  const output: Topo = [];
  const visited: Visited = {};
  for (const name in input) {
    if (!visited[name]) {
      dfs(source, name, visited, input, output);
    }
  }

  return output;
}

export type Result = {
  date: Date;
  value?: any;
  error?: any;
};

export type Closure<T = Result | null> = {
  id: string;
  env: Record<string, any>;
  params: string[];
  timestamp: number;
  fn: Function;
  result: T;
};

type Options = {
  onReturned?: (closure: Closure<Result>) => void;
  onDisposed?: (closure: Closure<null>) => void;
};

function isEqualEnv(a: Record<string, any>, b: Record<string, any>) {
  for (const key in a) {
    if (!b.hasOwnProperty(key)) {
      return false;
    }
  }
  for (const key in b) {
    if (!a.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
}

export default class Runtime {
  public readonly options: Options;

  public readonly snippets = new Map<string, Snippet>();
  public readonly closures: Record<string, Closure> = {};

  protected topo: Topo = [];
  protected graph = new Map<string, ((values: any[]) => any)[]>();
  protected disposed = false;
  protected obsoleted: { closures: Record<string, Closure>; topo: Topo }[] = [];

  constructor(codes: string[] = [], options?: Options) {
    this.options = { ...options };
    codes.forEach((code) => this.add(code));
  }

  add(code: string, id = `snippet-${this.snippets.size}`) {
    const old = this.snippets.get(id);
    if (!old || old.code !== code) {
      this.snippets.set(id, new Snippet(code, id));
      this.setup(id);
    }
    return this;
  }

  del(id: string) {
    if (this.snippets.has(id)) {
      this.snippets.delete(id);
      delete this.closures[id];
      this.setup();
    }
    return this;
  }

  protected setup(target?: string) {
    const oldTopo = this.topo;
    const oldClosures: Record<string, Closure> = {};

    this.topo = toposort(this.snippets);
    const closures: Record<string, Closure> = {};

    this.snippets.forEach(({ id }) => {
      const env: Record<string, any> = {};
      const params: string[] = [];
      this.topo.forEach(({ name, from, to }) => {
        if (from.has(id)) {
          env[name] = undefined;
        }
        if (to.has(id)) {
          params.push(name);
        }
      });

      closures[id] = {
        id,
        env: this.proxy(env, id),
        params,
        timestamp: 0,
        fn: nop,
        result: null,
      };
    });

    this.snippets.forEach((snippet, id) => {
      const oldClosure = this.closures[id];
      const newClosure = closures[id];

      if (
        id === target ||
        !isEqualWith(oldClosure.params, newClosure.params) ||
        !isEqualEnv(oldClosure.env, newClosure.env)
      ) {
        if (oldClosure?.result) {
          oldClosures[id] = oldClosure;
        }

        this.closures[id] = newClosure;
        // eslint-disable-next-line no-new-func
        this.closures[id].fn = new Function(
          "__env__",
          ...newClosure.params,
          snippet.transform()
        );
      }
    });
    this.graph = this.createGraph();
    this.obsoleted.push({ closures: oldClosures, topo: oldTopo });
  }

  private createGraph() {
    const graph: Runtime["graph"] = new Map();
    this.topo.forEach(({ name, to }, i) => {
      if (to.size === 0) {
        return;
      }

      const handlers: ((values: any[]) => any)[] = [];
      for (const target of to) {
        const closure = this.closures[target];
        const params = closure.params;
        const others = new Set<string>();
        for (let j = 0; j < this.topo.length; ++j) {
          if (j !== i && this.topo[j].to.has(target)) {
            let ts = -1;
            let other: string | undefined;
            for (const id of this.topo[j].from) {
              const obj = this.closures[id];
              if (obj.timestamp > ts) {
                other = id;
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
          this.compute(closure, ...values);
        });
      }

      if (handlers.length) {
        graph.set(name, handlers);
      }
    });

    return graph;
  }

  protected cleanup(closure: Closure) {
    if (closure.result && typeof closure.result.value === "function") {
      closure.result.value();
      closure.result = null;
      this.options.onDisposed?.(closure as Closure<null>);
    }
  }

  protected cleanupBy(closures: Record<string, Closure>, topo: Topo) {
    for (let i = topo.length - 1; i >= 0; --i) {
      for (const id of this.topo[i].from) {
        const closure = closures[id];
        closure && this.cleanup(closure);
      }
    }
  }

  protected proxy(env: Record<string, any>, id: string) {
    return new Proxy(env, {
      set: (target, key, value, receiver) => {
        if (value === target[key as string]) {
          return false;
        }

        const ret = Reflect.set(target, key, value, receiver);
        if (ret) {
          this.closures[id].timestamp = new Date().getTime();
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
    if (this.obsoleted.length) {
      this.obsoleted.forEach((item) =>
        this.cleanupBy(item.closures, item.topo)
      );
      this.obsoleted = [];
    }

    const done = new Set<string>();
    this.topo.forEach(({ from, to }) => {
      for (const id of from) {
        if (!done.has(id)) {
          done.add(id);
          const closure = this.closures[id];
          if (!closure.result) {
            frame(() => this.compute(closure));
          }
        }
      }
      // will be automatically ran by functions within from
      for (const i of to) {
        done.add(i);
      }
    });

    return this;
  }

  dispose() {
    this.disposed = true;
    this.cleanupBy(this.closures, this.topo);
  }

  compute(closure: Closure, ...args: any[]) {
    try {
      const value = closure.fn!(closure.env, ...args);
      closure.result = { value, date: new Date() };
    } catch (error) {
      closure.result = { error, date: new Date() };
    }
    this.options.onReturned?.(closure as Closure<Result>);
  }
}
