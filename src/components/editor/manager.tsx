import {
  NodeSpec,
  Schema,
  MarkSpec,
  NodeType,
  MarkType,
  Node as ProsemirrorNode,
} from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import { Decoration } from "prosemirror-view";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import union from "lodash.union";

type Plugins = Plugin[] | ((type: NodeType | MarkType) => Plugin[]);

type Base = {};

type NodeExtension = Base & {
  node: NodeSpec;
};

type MarkExtension = Base & {
  mark: MarkSpec;
};

type PluginExtension = Base & {
  plugins: Plugins;
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

const minimalExtensions = ["doc", "paragraph", "text", "keymap"];
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
  readonly deps: Record<string, Dependency[]> = {};
  readonly groups: Record<string, string[]> = {};
  readonly tags: Record<string, string> = {};
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

  createConfig() {
    if (!this.bfsPath.length) {
      return undefined;
    }

    const nodes: Record<string, NodeSpec> = {};
    const marks: Record<string, MarkSpec> = {};
    const allPlugins: Plugin[] = [];

    this.eachExtension((extension, name) => {
      const node: NodeSpec | undefined = (extension as NodeExtension).node;
      const mark: MarkSpec | undefined = (extension as MarkExtension).mark;

      if (node) {
        nodes[name] = node;
      } else if (mark) {
        marks[name] = mark;
      }
    });

    const schema = new Schema({ nodes, marks });
    const keys = union(
      [...Object.keys(schema.nodes), ...Object.keys(schema.marks)],
      Object.keys(this.extensions)
    );

    for (const key of keys) {
      const extension = this.getExtension(key);
      const plugins = (extension as PluginExtension).plugins || [];

      let thisPlugins: Plugin[] = [];
      if (typeof plugins === "function") {
        thisPlugins = plugins(schema.nodes[key] || schema.marks[key]);
      } else {
        thisPlugins = plugins;
      }

      allPlugins.push(...thisPlugins);
    }

    return { schema, plugins: allPlugins };
  }

  eachExtension = (fn: (extension: Extension, name: string) => void) => {
    for (const name of this.bfsPath) {
      if (!this.groups[name]) {
        fn(this.getExtension(name), name);
      }
    }
  };

  private getExtension = (name: string) => this.extensions[name];

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
        this.groups[group].push(name);
      }

      if (!this.deps[name]) {
        this.deps[name] = [];
      }
      this.deps[name].push(...parseDeps(node));

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
    for (const group in this.groups) {
      this.groups[group].sort((a, b) => {
        let x = -1;
        let y = -1;
        const aTag = this.tags[a];
        const bTag = this.tags[b];
        for (let i = 0; i < this.precedence.length; ++i) {
          const item = this.precedence[i];
          if (typeof item === "string") {
            if (x === -1 && item === aTag) {
              x = i;
            }
            if (y === -1 && item === bTag) {
              y = i;
            }
          } else {
            if (x === -1 && aTag.match(item)) {
              x = i;
            }
            if (y === -1 && bTag.match(item)) {
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
        for (const dep of this.deps[name]) {
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
