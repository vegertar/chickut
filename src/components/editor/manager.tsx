import {
  Schema as ProsemirrorSchema,
  NodeSpec,
  MarkSpec,
  ParseRule,
} from "prosemirror-model";
import { EditorState, Plugin } from "prosemirror-state";
import { DirectEditorProps } from "prosemirror-view";
import flattenDepth from "lodash.flattendepth";

import { Engine, BlockRule, InlineRule } from "./engine";
import {
  Extension,
  ExtensionSchema,
  NodeExtension,
  MarkExtension,
  ExtensionPlugins,
  NodeType,
  MarkType,
  AfterPluginExtension,
  PluginExtension,
  RuleExtension,
} from "./types";

const tagMatcher = /^(\w+)/;

// the smaller index, the lower priority, the more general extension
const defaultTagPrecedence = [
  "p",
  "div",
  "h1",
  /^(ul|ol|li)$/,
  "hr",
  "blockquote",
  "pre",
];

const contentMatcher = /(\w+)(\+|\*|\{(\d+)(,(\d+)?)?\})?/;
const parseDeps = (spec?: { content?: string | null }) => {
  const result: { content: string; minimal: number }[] = [];
  spec?.content?.split(" ").forEach((item) => {
    if (!item) {
      return;
    }
    const matched = item.match(contentMatcher);
    if (!matched) {
      return;
    }
    const [, content, marker, left] = matched;
    const minimal =
      marker === undefined || marker === "+"
        ? 1
        : marker === "*"
        ? 0
        : parseInt(left);
    result.push({ content, minimal });
  });
  return result;
};

type Extensions = Record<string, Extension>;
type Dependency = { content: string; minimal?: number };

type DfsVisited = Record<string, undefined | 1 | 2>;
type BfsVisited = Record<string, boolean>;

export class MissingContentError extends Error {
  constructor(public readonly content: string) {
    super(`Missing Content Error: ${content}`);
  }
}

export class Manager {
  readonly deps: Record<string, Dependency[] | undefined> = {};
  // node groups
  readonly groups: Record<string, string[] | undefined> = {};
  // node tags
  readonly tags: Record<string, string | undefined> = {};
  readonly nonDag: string[] = [];
  readonly dfsPath: string[] = [];
  readonly bfsPath: string[] = [];
  readonly nodes: string[] = [];
  readonly marks: string[] = [];
  readonly plugins: string[] = [];
  readonly afterNodes: Record<string, string[] | undefined> = {};
  readonly afterMarks: Record<string, string[] | undefined> = {};

  constructor(
    public readonly extensions: Extensions,
    public readonly tagPrecedence = defaultTagPrecedence
  ) {
    this.init();
    this.detectDAG();
    this.detectInfinity();
    this.sortDeps();
    this.orderExtensions();
  }

  createConfig(topNode?: string) {
    if (!this.bfsPath.length) {
      return undefined;
    }

    const schema = this.createSchema(topNode);
    const plugins = this.createPlugins(schema);

    return {
      state: EditorState.create<ExtensionSchema>({ schema, plugins }),
    } as DirectEditorProps<ExtensionSchema>;
  }

  private createSchema(topNode = "doc") {
    if (topNode !== this.nodes[0]) {
      throw new MissingContentError(topNode);
    }

    if (this.nodes.indexOf("text") < 0) {
      throw new MissingContentError("text");
    }

    const nodes: Record<string, NodeSpec> = Object.fromEntries(
      this.nodes.map((name) => [
        name,
        (this.extensions[name] as NodeExtension).node,
      ])
    );

    const marks: Record<string, MarkSpec> = Object.fromEntries(
      this.marks.map((name) => [
        name,
        (this.extensions[name] as MarkExtension).mark,
      ])
    );

    const schema = new ProsemirrorSchema({
      nodes,
      marks,
      topNode,
    }) as ExtensionSchema;
    schema.cached.engine = new Engine();

    return schema;
  }

  private createPlugins(schema: ExtensionSchema) {
    const all: Plugin[] = [];
    const engine = schema.cached.engine;

    // plugin names from low priority to high
    const names = [...this.nodes, ...this.marks, ...this.plugins];

    for (let i = 0; i < names.length; ++i) {
      // since Prosemirror use plugins via first-come-first-served,
      // so we adding by reverse order, i.e. from special to general
      const name = names[names.length - i - 1];
      const extension = this.extensions[name];
      const nodeType = schema.nodes[name] as NodeType | undefined;
      const markType = schema.marks[name] as MarkType | undefined;

      this.fromRule(
        engine,
        extension as RuleExtension,
        name,
        nodeType,
        markType
      );

      const plugins = extension.plugins;
      if (Array.isArray(plugins)) {
        all.push(...plugins);
      } else if (plugins) {
        const type = nodeType || markType || schema;
        const fn = plugins as ExtensionPlugins<typeof extension, typeof type>;
        all.push(...fn.call({ ...extension, name }, type));
      }

      this.fromAfter(all, name, nodeType, markType);
    }

    return all;
  }

  private fromRule(
    engine: Engine,
    { rule }: RuleExtension,
    name: string,
    nodeType?: NodeType,
    markType?: MarkType
  ) {
    if (rule) {
      const { handle, alt, postHandle } = rule;
      if (handle) {
        const rule = { name, handle, alt };
        if (nodeType) {
          const group = nodeType.spec.group as NodeExtension["node"]["group"];
          if (group === "block") {
            engine.block.ruler.append(rule as BlockRule);
          } else if (group === "inline") {
            engine.inline.ruler.append(rule as InlineRule);
          } else {
            throw new Error(
              `cannot determine rule type for unknown group: ${group}`
            );
          }
        } else if (markType) {
          engine.inline.ruler.append(rule as InlineRule);
        }
      }
      if (postHandle) {
        engine.postInline.ruler.append({ name, handle: postHandle });
      }
    }
  }

  private fromAfter(
    all: Plugin[],
    after: string,
    nodeType?: NodeType,
    markType?: MarkType
  ) {
    if (nodeType) {
      this.afterNodes[after]?.forEach((name) => {
        const afterExtension = this.extensions[name] as AfterPluginExtension<
          "node"
        >;
        const plugins = afterExtension.plugins;
        all.push(
          ...(Array.isArray(plugins)
            ? plugins
            : plugins.call({ ...afterExtension, name }, nodeType))
        );
      });
    } else if (markType) {
      this.afterMarks[after]?.forEach((name) => {
        const afterExtension = this.extensions[name] as AfterPluginExtension<
          "mark"
        >;
        const plugins = afterExtension.plugins;
        all.push(
          ...(Array.isArray(plugins)
            ? plugins
            : plugins.call({ ...afterExtension, name }, markType))
        );
      });
    }
  }

  private init() {
    for (const name in this.extensions) {
      const deps: Dependency[] = (this.deps[name] = []);
      const node = (this.extensions[name] as NodeExtension).node;
      if (!node) {
        continue;
      }

      deps.push(...parseDeps(node));

      if (node.group) {
        const group = node.group;
        (this.groups[group] = this.groups[group] || []).push(name);
      }

      const tag = this.getTag(node);
      if (tag) {
        this.tags[name] = tag;
      }
    }
  }

  private detectDAG() {
    const dfsVisited: DfsVisited = {};
    for (const name in this.extensions) {
      if (!dfsVisited[name]) {
        this.dfs(name, dfsVisited);
      }
    }
  }

  private orderExtensions() {
    // nodes order is determined by DAG and tag precedence
    // marks order is determined by insertion order
    // plugins order is determined by either associated node/mark (with after property) or insertion order
    for (const name of this.bfsPath) {
      const extension = this.extensions[name];
      if (!extension) {
        // some group names are not valid extensions
        continue;
      }

      const node: NodeSpec | undefined = (extension as NodeExtension).node;
      const mark: MarkSpec | undefined = (extension as MarkExtension).mark;
      const plugin = extension as PluginExtension | undefined;

      if (node) {
        this.nodes.push(name);
      } else if (mark) {
        this.marks.push(name);
      } else if (plugin) {
        const { type, after } = plugin;
        if (type && after) {
          const plugins =
            type === "node"
              ? this.afterNodes
              : type === "mark"
              ? this.afterMarks
              : null;
          if (plugins) {
            (plugins[after] = plugins[after] || []).push(name);
          } else {
            console.warn("discarded plugin", name);
          }
        } else {
          this.plugins.push(name);
        }
      }
    }
  }

  private getTag(props?: { parseDOM?: ParseRule[] | null }) {
    const rules = props?.parseDOM;

    if (rules) {
      for (const { tag } of rules) {
        const matched = tag && tag.match(tagMatcher);
        if (matched) {
          return matched[1];
        }
      }
    }

    return "";
  }

  private tagSorter = (a: string, b: string) => {
    const defaultPriority = this.tagPrecedence.length;
    let x = defaultPriority;
    let y = defaultPriority;

    const aTag = this.tags[a];
    const bTag = this.tags[b];

    for (let i = 0; i < this.tagPrecedence.length; ++i) {
      const item = this.tagPrecedence[i];
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
  };

  private detectInfinity() {
    for (const name of this.nonDag) {
      if (this.notSatisfied(name)) {
        throw new Error(`infinite dependency detected: ${name}`);
      }
    }
  }

  private sortDeps() {
    const bfsVisited: BfsVisited = {};
    for (let i = this.dfsPath.length - 1; i >= 0; --i) {
      const name = this.dfsPath[i];
      if (!bfsVisited[name]) {
        this.bfs(name, bfsVisited);
      }
    }
    console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~", this.dfsPath, this.bfsPath);
  }

  private bfs(root: string, visited: BfsVisited) {
    const queue = [root];
    const depths = [1];
    let index = 0;

    do {
      const name = queue[index++];
      if (!visited[name]) {
        visited[name] = true;

        const grouped = this.groups[name];
        const deps = this.deps[name];

        if (grouped) {
          for (const item of grouped) {
            queue.push(item);
          }
          depths.push(queue.length);
        } else if (deps) {
          for (const dep of deps) {
            queue.push(dep.content);
          }
        }
      }
    } while (queue.length > index);

    if (depths[depths.length - 1] < queue.length) {
      depths.push(queue.length);
    }

    const layers: string[][] = [];
    for (let i = 0; i < depths.length; ++i) {
      layers.push(queue.slice(i ? depths[i - 1] : 0, depths[i]));
    }

    layers.forEach((layer) => layer.sort(this.tagSorter));
    for (const name of new Set(flattenDepth(layers))) {
      this.bfsPath.push(name);
    }

    console.log(root, layers);
  }

  private dfs(name: string, visited: DfsVisited) {
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
  }

  // detect if the content of given name does not satisfy the minimal requirement
  private notSatisfied(name: string, visited: DfsVisited = {}, minimal = 0) {
    let n = 0;

    if (!visited[name]) {
      visited[name] = 1;
      const grouped = this.groups[name];

      if (grouped) {
        for (const item of grouped) {
          if (!this.notSatisfied(item, visited)) {
            ++n;
          } else {
            --n;
          }
        }
      } else {
        for (const dep of this.deps[name]!) {
          if (!this.notSatisfied(dep.content, visited, dep.minimal)) {
            ++n;
          } else {
            --n;
          }
        }
      }

      visited[name] = 2;
    }

    return n < minimal;
  }
}
