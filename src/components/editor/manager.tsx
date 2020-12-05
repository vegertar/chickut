import {
  NodeSpec,
  Schema,
  MarkSpec,
  NodeType,
  MarkType,
  Node as ProsemirrorNode,
  ResolvedPos,
} from "prosemirror-model";
import { EditorState, Plugin } from "prosemirror-state";
import { Decoration, DirectEditorProps } from "prosemirror-view";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import union from "lodash.union";
import Engine, { BlockRule, InlineRule, NoParserError } from "./engine";

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

type Extension = NodeExtension | MarkExtension | PluginExtension;

type ExtensionView = {
  dom: Node;
  node: ProsemirrorNode;
  getPos: boolean | (() => number);
  decorations: Decoration[];
};

export interface Events {
  load: Extension;
  ["off-load"]: {};
  ["create-view"]: ExtensionView;
  ["update-view"]: Pick<ExtensionView, "node" | "decorations">;
  ["destroy-view"]: {};
}

const minimalExtensions = ["doc", "paragraph", "text", "keymap"]; // TODO: test only
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
type Extensions = Record<string, Events["load"]>;
type Dependency = { content: string; minimal?: number };

type DfsStatus = undefined | 1 | 2;
type Visited = Record<string, DfsStatus>;

export class MissingContentError extends Error {
  constructor(public readonly content: string) {
    super(`Missing Content Error: ${content}`);
  }
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
    const { plugins, engine } = this.createPluginsEngine(schema);

    // TODO: transfer history
    return {
      state: EditorState.create({ schema, plugins }),
      handleTextInput: (view, from, to, text) => {
        if (view.composing) {
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

        try {
          const tokens = engine.parse(pendingText);
          console.log(tokens);
        } catch (e) {
          if (e instanceof NoParserError) {
            return false;
          }
          throw e;
        }

        return false;
      },
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

  private createPluginsEngine(schema: Schema) {
    const allPlugins: Plugin[] = [];
    const engine = new Engine();

    const keys = union(
      [...Object.keys(schema.nodes), ...Object.keys(schema.marks)],
      Object.keys(this.extensions)
    );

    for (const key of keys) {
      const type = schema.nodes[key] || schema.marks[key];
      const { plugins = [], rule } = this.getExtension(key) || {};

      if (rule) {
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

    return { plugins: allPlugins, engine };
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
    for (const item of minimalExtensions) {
      if (this.extensions[item] === undefined) {
        throw new MissingContentError(item);
      }
    }
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

export function createConfig(
  extensions: Record<string, Extension>,
  autoFix: boolean
) {
  let manager: Manager | undefined;
  let err: Error | undefined;

  for (let i = 0; i < 10; ++i) {
    try {
      // TODO: create Manager under Web Worker
      manager = new Manager(extensions);
      err = undefined;
    } catch (e) {
      err = e;
      if (e instanceof MissingContentError && autoFix) {
        switch (e.content) {
          case "doc":
            extensions = {
              ...extensions,
              doc: {
                node: {
                  content: "block+",
                },
              },
            };
            continue;

          case "paragraph":
            extensions = {
              ...extensions,
              paragraph: {
                node: {
                  content: "inline*",
                  group: "block",
                  parseDOM: [{ tag: "p" }],
                  toDOM: () => ["p", 0],
                },
              },
            };
            continue;

          case "inline":
            extensions = {
              ...extensions,
              text: {
                node: {
                  group: "inline",
                },
              },
            };
            continue;

          case "text":
            extensions = {
              ...extensions,
              text: { node: {} },
            };
            continue;

          case "keymap":
            extensions = {
              ...extensions,
              keymap: {
                plugins: [keymap(baseKeymap)],
              },
            };
            continue;
        }
      }
    }
    break;
  }

  if (err) {
    throw err;
  }

  return manager?.createConfig();
}
