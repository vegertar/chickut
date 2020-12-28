import {
  Schema as ProsemirrorSchema,
  NodeSpec,
  MarkSpec,
  Slice,
  ResolvedPos,
} from "prosemirror-model";
import { EditorState, Plugin } from "prosemirror-state";
import { DirectEditorProps } from "prosemirror-view";
import union from "lodash.union";

import { Engine, BlockRule, InlineRule } from "./engine";
import {
  Extension,
  ExtensionSchema,
  NodeExtension,
  MarkExtension,
  ExtensionPlugins,
} from "./types";

// the smaller index of tag, the more general extension, the lower priority
const defaultNodesPrecedence = [
  "p",
  /^(div|iframe)$/,
  /^h[1-6]$/,
  /^(ul|ol|li)$/,
  "hr",
  "blockquote",
  "pre",
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
  schema: ProsemirrorSchema,
  text: string,
  $context: ResolvedPos<ProsemirrorSchema>,
  plain: boolean
) {
  console.log(text, $context, plain);
  return Slice.empty;
}

export class Manager {
  readonly deps: Record<string, Dependency[] | undefined> = {};
  readonly groups: Record<string, string[] | undefined> = {};
  readonly tags: Record<string, string | undefined> = {};
  readonly nonDag: string[] = [];
  readonly dfsPath: string[] = [];
  readonly bfsPath: string[] = [];

  constructor(
    public readonly extensions: Extensions,
    public readonly nodesPrecedence = defaultNodesPrecedence
  ) {
    this.init();
    this.detectDAG();
    this.sortGroups();
    this.detectInfinity();
    this.sortDeps();
  }

  createConfig(
    topNode?: string
  ): DirectEditorProps<ExtensionSchema> | undefined {
    if (!this.bfsPath.length) {
      return undefined;
    }

    const schema = this.createSchema(topNode);
    const plugins = this.createPlugins(schema);

    // TODO: transfer history
    const state = EditorState.create<ExtensionSchema>({ schema, plugins });

    return {
      state,
      clipboardTextParser: (text, $context, plain) =>
        clipboardTextParser(schema, text, $context, plain),
    };
  }

  private createSchema(topNode = "doc") {
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

    if (!nodes[topNode]) {
      throw new MissingContentError(topNode);
    }
    if (!nodes.text) {
      throw new MissingContentError("text");
    }

    const schema = new ProsemirrorSchema({
      nodes,
      marks,
      topNode,
    }) as ExtensionSchema;
    schema.cached.engine = new Engine();
    return schema;
  }

  private createPlugins(schema: ExtensionSchema) {
    const allPlugins: Plugin[] = [];
    const engine = schema.cached.engine;
    const keys = union(
      [...Object.keys(schema.nodes), ...Object.keys(schema.marks)],
      Object.keys(this.extensions)
    );

    for (let i = 0; i < keys.length; ++i) {
      // adding by reverse order, i.e. from special to general
      const key = keys[keys.length - i - 1];

      const type = schema.nodes[key] || schema.marks[key];
      const { plugins = [], rule = {} } = this.getExtension(key) || {};

      let thisPlugins: Plugin[] = [];
      if (typeof plugins === "function") {
        thisPlugins = (plugins as ExtensionPlugins<typeof type>)(type);
      } else {
        thisPlugins = plugins;
      }

      allPlugins.push(...thisPlugins);

      const { handle, alt } = rule;
      if (handle) {
        // TODO: support mark type
        const rule = { name: key, handle, alt };
        if (type.isBlock) {
          engine.block.ruler.add(rule as BlockRule);
        } else if (type.isInline) {
          engine.inline.ruler.add(rule as InlineRule);
        }
      }
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

      if (node?.parseDOM) {
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
    const defaultPriority = this.nodesPrecedence.length;
    for (const group in this.groups) {
      this.groups[group]?.sort((a, b) => {
        let x = defaultPriority;
        let y = defaultPriority;
        const aTag = this.tags[a];
        const bTag = this.tags[b];
        for (let i = 0; i < this.nodesPrecedence.length; ++i) {
          const item = this.nodesPrecedence[i];
          if (typeof item === "string") {
            if (x === defaultPriority && item === aTag) {
              x = i;
            }
            if (y === defaultPriority && item === bTag) {
              y = i;
            }
          } else {
            if (x === defaultPriority && aTag && item.test(aTag)) {
              x = i;
            }
            if (y === defaultPriority && bTag && item.test(bTag)) {
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
