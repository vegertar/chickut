import {
  NodeSpec,
  Schema,
  MarkSpec,
  NodeType,
  MarkType,
  Slice,
  ResolvedPos,
} from "prosemirror-model";
import { EditorState, Plugin, Transaction } from "prosemirror-state";
import { DirectEditorProps, EditorView } from "prosemirror-view";
import union from "lodash.union";

import Engine, { Token, BlockRule, InlineRule, NoParserError } from "./engine";

type Base = {
  rule?: BlockRule | InlineRule;
};
type SpecBase = {};

type ExtensionSpec<T> = T & SpecBase;
type ExtensionPlugins<T> = (type: T) => Plugin[];

type NodeExtension = Base & {
  node: ExtensionSpec<NodeSpec>;
  plugins?: Plugin[] | ExtensionPlugins<NodeType>;
};

type MarkExtension = Base & {
  mark: ExtensionSpec<MarkSpec>;
  plugins?: Plugin[] | ExtensionPlugins<MarkType>;
};

type PluginExtension = Base & {
  plugins: Plugin[];
};

export type Extension = NodeExtension | MarkExtension | PluginExtension;

const defaultPrecedence = [
  "p",
  "blockquote",
  "pre",
  "ol",
  "li",
  "ul",
  /^h[1-6]$/,
  "hr",
];

const content = /(\w+)(\+)?/; // TODO: match "paragraph block*"
const parseDeps = (node?: NodeSpec) => {
  const result = (node?.content || "").match(content);
  if (result) {
    const content = result[1];
    const required = !!result[2];
    return [{ content, minimal: required ? 1 : 0 }];
  }
  return [];
};

// TODO: support multiple extensions for the same name
type Extensions = Record<string, Extension>;
type Dependency = { content: string; minimal?: number };

type DfsStatus = undefined | 1 | 2;
type Visited = Record<string, DfsStatus>;

export class MissingContentError extends Error {
  constructor(public readonly content: string) {
    super(`Missing Content Error: ${content}`);
  }
}

function clipboardTextParser(
  schema: Schema,
  text: string,
  $context: ResolvedPos<Schema>,
  plain: boolean
) {
  console.log(text, $context, plain);
  return Slice.empty;
}

function handleTextInput(
  view: EditorView,
  from: number,
  to: number,
  text: string
) {
  if (view.composing) {
    // TODO: what is composition?
    return false;
  }

  const state = view.state;
  const $from = state.doc.resolve(from);
  if ($from.parent.type.spec.code) {
    return false;
  }

  const textBefore = $from.parent.textBetween(
    Math.max(0, $from.parentOffset - 500), // backwards maximum 500
    $from.parentOffset,
    undefined,
    "\ufffc"
  );
  const pendingText = textBefore + text;
  const start = from - textBefore.length;
  const end = to;

  const schema = state.schema as Schema;
  const engine = schema.cached.engine as Engine;

  let tokens: Token[];
  try {
    tokens = engine.parse(pendingText);
  } catch (e) {
    if (e instanceof NoParserError) {
      return false;
    }
    throw e;
  }

  let offset = 0;
  let tr: Transaction | undefined;
  for (const token of engine.walk(tokens)) {
    offset += token.nesting;
    switch (token.nesting) {
      case 1: {
        if (!tr) {
          tr = state.tr.deleteRange(start, end);
        }

        // right trim "_open" postfix
        const key = token.type.slice(0, token.type.length - 5);
        const type = schema.nodes[key];
        tr = tr.setBlockType(offset, undefined, type, token.attrs);

        break;
      }
      case 0:
        if (token.content && token.type === "text") {
          offset += token.content.length;
          tr?.insertText(token.content);
        }
        break;
    }
  }

  if (tr) {
    view.dispatch(tr);
  }
  return !!tr;
}

export default class Manager {
  readonly deps: Record<string, Dependency[] | undefined> = {};
  readonly groups: Record<string, string[] | undefined> = {};
  readonly tags: Record<string, string | undefined> = {};
  readonly nonDag: string[] = [];
  readonly dfsPath: string[] = [];
  readonly bfsPath: string[] = [];

  constructor(
    public readonly extensions: Extensions,
    public readonly precedence = defaultPrecedence
  ) {
    this.init();
    this.detectDAG();
    this.sortGroups();
    this.detectInfinity();
    this.sortDeps();
  }

  createConfig(): DirectEditorProps | undefined {
    if (!this.bfsPath.length) {
      return undefined;
    }

    const schema = this.createSchema();
    const plugins = this.createPlugins(schema);

    // TODO: transfer history
    const state = EditorState.create({ schema, plugins });

    return {
      state,
      handleTextInput,
      clipboardTextParser: (text, $context, plain) =>
        clipboardTextParser(schema, text, $context, plain),
    };
  }

  private createSchema() {
    const nodes: Record<string, NodeSpec> = {};
    const marks: Record<string, MarkSpec> = {};

    this.eachExtension((extension, name) => {
      const node: NodeSpec | undefined = (extension as NodeExtension).node;
      const mark: MarkSpec | undefined = (extension as MarkExtension).mark;

      if (node) {
        nodes[name] = node;
      } else if (mark) {
        marks[name] = mark;
      }
    });

    return new Schema({ nodes, marks });
  }

  private createPlugins(schema: Schema) {
    const allPlugins: Plugin[] = [];
    const engine = new Engine();

    // EditorProps handlers will retrieve engine from the schema cache
    schema.cached.engine = engine;

    const keys = union(
      [...Object.keys(schema.nodes), ...Object.keys(schema.marks)],
      Object.keys(this.extensions)
    );

    for (const key of keys) {
      const type = schema.nodes[key] || schema.marks[key];
      const { plugins = [], rule } = this.getExtension(key) || {};

      if (rule) {
        // TODO: engine rule order might be opposite of keys'
        if (type.isBlock) {
          engine.block.addRule(key, rule as BlockRule);
        } else if (type.isInline) {
          engine.inline.addRule(key, rule as InlineRule);
        }
      }

      let thisPlugins: Plugin[] = [];
      if (typeof plugins === "function") {
        thisPlugins = (plugins as ExtensionPlugins<typeof type>)(type);
      } else {
        thisPlugins = plugins;
      }

      allPlugins.push(...thisPlugins);
    }

    return allPlugins;
  }

  eachExtension = (fn: (extension: Extension, name: string) => void) => {
    for (const name of this.bfsPath) {
      const extension = this.getExtension(name);
      extension && fn(extension, name);
    }
  };

  private getExtension = (name: string): Extension | undefined =>
    this.extensions[name];

  private init = () => {
    for (const name in this.extensions) {
      const extension = this.getExtension(name) as NodeExtension;
      const node: NodeSpec | undefined = extension.node;
      const group = node?.group;

      if (group) {
        if (!this.groups[group]) {
          this.groups[group] = [];
        }
        this.groups[group]!.push(name);
      }

      if (!this.deps[name]) {
        this.deps[name] = [];
      }
      this.deps[name]!.push(...parseDeps(node));

      // TODO:
      if (node && node.parseDOM) {
        for (const { tag } of node.parseDOM) {
          if (tag) {
            this.tags[name] = tag;
            break;
          }
        }
      }
    }
  };

  private detectDAG = () => {
    const dfsVisited: Visited = {};
    this.dfsPath.splice(0);
    this.nonDag.splice(0);

    for (const name in this.extensions) {
      if (!dfsVisited[name]) {
        this.dfs(name, dfsVisited);
      }
    }
  };

  private sortGroups = () => {
    const defaultPriority = this.precedence.length;
    for (const group in this.groups) {
      this.groups[group]?.sort((a, b) => {
        let x = defaultPriority;
        let y = defaultPriority;
        const aTag = this.tags[a];
        const bTag = this.tags[b];
        for (let i = 0; i < this.precedence.length; ++i) {
          const item = this.precedence[i];
          if (typeof item === "string") {
            if (x === defaultPriority && item === aTag) {
              x = i;
            }
            if (y === defaultPriority && item === bTag) {
              y = i;
            }
          } else {
            if (x === defaultPriority && aTag?.match(item)) {
              x = i;
            }
            if (y === defaultPriority && bTag?.match(item)) {
              y = i;
            }
          }
        }

        return x - y;
      });
    }
  };

  private detectInfinity = () => {
    for (const name of this.nonDag) {
      if (this.dfsNonDag(name)) {
        throw new Error(`infinite dependency detected: ${name}`);
      }
    }
  };

  private sortDeps = () => {
    const bfsVisited: Visited = {};
    for (let i = this.dfsPath.length - 1; i >= 0; --i) {
      const name = this.dfsPath[i];
      if (!bfsVisited[name]) {
        this.bfs(name, bfsVisited);
      }
    }
  };

  private bfs = (root: string, visited: Visited) => {
    let index = -1;
    const queue = [] as string[];

    do {
      const name = queue[index++] || root;
      if (!visited[name]) {
        visited[name] = 1;
        this.bfsPath.push(name);

        const grouped = this.groups[name];
        const deps = this.deps[name];

        if (grouped) {
          for (const item of grouped) {
            queue.push(item);
          }
        } else if (deps) {
          for (const dep of deps) {
            queue.push(dep.content);
          }
        }
      }
    } while (queue.length > index);
  };

  private dfs = (name: string, visited: Visited) => {
    const status = visited[name];
    if (status === 1) {
      this.nonDag.push(name);
      return;
    }

    if (!status) {
      visited[name] = 1;
      const grouped = this.groups[name];
      const deps = this.deps[name];

      if (grouped) {
        for (const item of grouped) {
          this.dfs(item, visited);
        }
      } else if (deps) {
        for (const dep of deps) {
          this.dfs(dep.content, visited);
        }
      } else {
        throw new MissingContentError(name);
      }
      visited[name] = 2;
      this.dfsPath.push(name);
    }
  };

  private dfsNonDag = (name: string, visited: Visited = {}, minimal = 0) => {
    let n = 0;

    if (!visited[name]) {
      visited[name] = 1;
      const grouped = this.groups[name];

      if (grouped) {
        for (const item of grouped) {
          if (!this.dfsNonDag(item, visited)) {
            ++n;
          } else {
            --n;
          }
        }
      } else {
        for (const dep of this.deps[name]!) {
          if (!this.dfsNonDag(dep.content, visited, dep.minimal)) {
            ++n;
          } else {
            --n;
          }
        }
      }

      visited[name] = 2;
    }

    return n < minimal;
  };
}
