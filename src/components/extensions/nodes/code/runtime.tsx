import { useEffect, useReducer } from "react";
import { parseModule, ESTree } from "meriyah";
import isEqualWith from "lodash.isequalwith";
import isEmpty from "lodash.isempty";

type ESTreeNodeType = ESTree.Node["type"] | ESTree.Expression["type"];
type Evaluators = Partial<Record<ESTreeNodeType, (x: ESTree.Node) => void>>;

const nop = () => {};
const ws = /^\s+$/;
const comment = /^\s*\/[/*]/;
const frame =
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : setImmediate;

const isEqualEnv = (a: Record<string, any>, b: Record<string, any>) => {
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
};

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
        if (!last.range) {
          last.range = range;
        }
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

    FunctionDeclaration: (node: ESTree.Node) => {
      const { id, params, body, range } = node as ESTree.FunctionDeclaration;
      if (id) {
        this.vars.push({
          name: "",
          kind: "var",
          nesting: this.nesting,
          range,
        });
        this.evaluators[id.type]?.(id);
      }
      this.nesting++;
      for (const param of params) {
        this.vars.push({
          kind: "let",
          nesting: this.nesting,
          name: "",
        });
        this.evaluators[param.type]?.(param);
      }
      body && this.evaluators[body.type]?.(body);
      this.nesting--;
    },

    TemplateLiteral: (node: ESTree.Node) => {
      const { expressions } = node as ESTree.TemplateLiteral;
      for (const item of expressions) {
        this.evaluators[item.type]?.(item);
      }
    },

    ExpressionStatement: (node: ESTree.Node) => {
      const { expression, range } = node as ESTree.ExpressionStatement;
      this.evaluators[expression.type]?.(expression);
      if (
        range &&
        this.range &&
        (range[1] === this.range[1] ||
          ws.test(this.code.slice(range[1])) ||
          comment.test(this.code.slice(range[1])))
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

    ReturnStatement: (node: ESTree.Node) => {
      const { argument: param } = node as ESTree.ReturnStatement;
      param && this.evaluators[param.type]?.(param);
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

// the records of global variables for each snippet
type Records = Record<string, string[]>;
// the DAG graph
type Topo = {
  // variable name
  name: string;
  // variable owner
  from: Set<string>;
  // variable listeners consisting of snippet id
  to: Set<string>;
}[];
// track DFS status
type Visited = Record<string, undefined | 1 | 2>;

export class CycleError extends Error {}
export class AmbiguousError extends Error {
  constructor(public readonly name: string) {
    super(`Ambiguous Name: ${name}`);
  }
}

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
  // time at function ended
  date: Date;
  // returned value if any
  value?: any;
  // caught exception if any
  error?: any;
};

export type Options = {
  onReturned?: (closure: Closure<Result>) => void;
  onDisposed?: (closure: Closure<null>) => void;
};

export type Closure<T = Result | null> = {
  // as same as code id
  id: string;
  // enviornment of this closure
  env: Record<string, any>;
  // last time of updating env
  timestamp: number;
  // parameters list of bound function
  params: string[];
  // bound function
  fn: Function;
  // result of function execution
  result: T;
  options: Options;
};

export class DisposedError extends Error {
  constructor() {
    super("Runtime Has Been Disposed");
  }
}

export default class Runtime {
  public readonly options: Options;
  public readonly snippets = new Map<string, Snippet>();
  public readonly state = {
    // id -> Closure
    closures: {} as Record<string, Closure>,
    // variables topo
    topo: [] as Topo,
  };

  protected readonly graph = {
    // variable -> <id>[]
    callers: {} as Record<string, Set<string>>,
    // id -> fn
    callees: {} as Record<string, () => any>,
  };

  protected running = true;

  constructor(codes: string[] = [], options?: Options) {
    this.options = { ...options };
    codes.forEach((code) => this.add(code));
    this.refresh();
  }

  // update a snippet and rebuild graph
  add(code: string, id = `snippet-${this.snippets.size}`) {
    if (!this.running) {
      throw new DisposedError();
    }
    const old = this.snippets.get(id);
    if (!old || old.code !== code) {
      this.snippets.set(id, new Snippet(code, id));
      this.setup(id);
    }
    return this;
  }

  // delete a snippet and rebuild graph
  delete(id: string) {
    if (!this.running) {
      throw new DisposedError();
    }
    if (this.snippets.has(id)) {
      this.snippets.delete(id);
      this.setup();
    }
    return this;
  }

  protected setup(target?: string) {
    const { closures: oldClosures, topo: oldTopo } = this.state;
    const topo = toposort(this.snippets);
    const closures: Record<string, Closure> = {};

    this.snippets.forEach(({ id }) => {
      const env: Record<string, any> = {};
      const params: string[] = [];
      topo.forEach(({ name, from, to }) => {
        if (from.has(id)) {
          env[name] = undefined;
        }
        if (to.has(id)) {
          params.push(name);
        }
      });

      const closure: Closure = {
        id,
        env,
        params,
        timestamp: 0,
        fn: nop,
        result: null,
        options: oldClosures[id]?.options || { ...this.options },
      };

      closure.env = this.proxy(env, closure);
      closures[id] = closure;
    });

    this.snippets.forEach((snippet, id) => {
      const oldClosure = oldClosures[id];
      const newClosure = closures[id];

      if (
        id === target ||
        !isEqualWith(oldClosure.params, newClosure.params) ||
        !isEqualEnv(oldClosure.env, newClosure.env)
      ) {
        // eslint-disable-next-line no-new-func
        newClosure.fn = new Function(
          "__env__",
          ...newClosure.params,
          snippet.transform()
        );
        closures[id] = newClosure;
      } else {
        // reuse old one
        closures[id] = oldClosure;
        delete oldClosures[id];
      }
    });

    this.state.closures = closures;
    this.state.topo = topo;

    if (!isEmpty(oldClosures)) {
      this.obsolete({ closures: oldClosures, topo: oldTopo });
    }
    this.resetGraph();
  }

  protected createCallees() {
    const { topo, closures } = this.state;
    const callees: Record<string, () => any> = {};

    for (const callee in closures) {
      const calleeClosure = closures[callee];
      const params = calleeClosure.params;
      const callers: number[] = [];

      for (let i = 0; i < topo.length; ++i) {
        if (topo[i].to.has(callee)) {
          callers.push(i);
        }
      }

      callees[callee] = () => {
        if (!this.running) {
          return;
        }

        const values = Array(params.length);
        for (const i of callers) {
          // find the latest caller
          let ts = -1;
          let caller: string | undefined;
          for (const id of topo[i].from) {
            const obj = closures[id];
            if (!obj) {
              // current evaluation had been obsoleted
              return;
            }
            if (obj.timestamp > ts) {
              caller = id;
              ts = obj.timestamp;
            }
          }

          if (caller) {
            // retrieve arguments
            const callerClosure = closures[caller];
            for (let i = 0; i < params.length; ++i) {
              const param = params[i];
              if (callerClosure.env.hasOwnProperty(param)) {
                values[i] = callerClosure.env[param];
              }
            }
          }
        }

        this.cleanup(calleeClosure);
        this.compute(calleeClosure, ...values);
      };
    }

    return callees;
  }

  protected resetGraph() {
    const callers: Record<string, Set<string>> = {};
    this.state.topo.forEach(({ name, to }) => {
      callers[name] = to;
    });
    this.graph.callees = this.createCallees();
    this.graph.callers = callers;
  }

  protected cleanup(closure: Closure) {
    if (closure.result && typeof closure.result.value === "function") {
      closure.result.value();
      closure.result = null;
      closure.options.onDisposed?.(closure as Closure<null>);
    }
  }

  protected obsolete({ topo, closures }: Runtime["state"]) {
    for (let i = topo.length - 1; i >= 0; --i) {
      for (const id of topo[i].from) {
        const closure = closures[id];
        if (closure) {
          this.cleanup(closure);
          // TODO: clear env and notify downstream
        }
      }
    }
  }

  protected proxy(env: Record<string, any>, closure: Closure) {
    return new Proxy(env, {
      set: (target, key, value, receiver) => {
        if (value === target[key as string]) {
          return false;
        }

        const ret = Reflect.set(target, key, value, receiver);
        if (ret) {
          closure.timestamp = new Date().getTime();
          const callees = this.graph.callers[key as string];
          callees?.forEach((callee) => frame(this.graph.callees[callee]));
        }

        return ret;
      },
    });
  }

  transform() {
    // TODO: export a complete js code
    return "";
  }

  refresh(target?: string, options?: Options) {
    if (!this.running) {
      throw new DisposedError();
    }

    if (!target) {
      const { topo, closures } = this.state;
      const done = new Set<string>();
      topo.forEach(({ from, to }) => {
        let n = done.size;
        for (const id of from) {
          if (!done.has(id)) {
            const closure = closures[id];
            done.add(id);
            frame(() => this.compute(closure));
          }
        }
        if (n < done.size) {
          // will be automatically ran by functions within from
          for (const i of to) {
            done.add(i);
          }
        }
      });
    } else {
      if (options) {
        const closure = this.state.closures[target];
        Object.assign(closure.options, options);
      }
      const fn = this.graph.callees[target];
      fn && frame(fn);
    }

    return this;
  }

  reconfigure(allOptions: Record<string, Options>) {
    for (const id in allOptions) {
      const options = allOptions[id];
      const closure = this.state.closures[id];
      closure && Object.assign(closure.options, options);
    }
  }

  dispose() {
    if (this.running) {
      this.running = false;
      this.obsolete(this.state);
      this.snippets.clear();
    }
  }

  compute(closure: Closure, ...args: any[]) {
    try {
      const value = closure.fn(closure.env, ...args);
      closure.result = { value, date: new Date() };
    } catch (error) {
      closure.result = { error, date: new Date() };
    }
    closure.options.onReturned?.(closure as Closure<Result>);
  }
}
