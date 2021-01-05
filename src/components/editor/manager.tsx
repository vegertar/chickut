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
} from "./types";

// the smaller index of tag, the more general extension, the lower priority
const defaultTagPrecedence = [
  "p",
  /^(div|iframe)$/,
  /^h[1-6]$/,
  /^(ul|ol|li)$/,
  "hr",
  "blockquote",
  "pre",
  /^(em|strong)$/,
];

const token = /(\w+)(\+|\*|\{(\d+)(,(\d+)?)?\})?/;
const parseDeps = (node?: NodeSpec) => {
  const result: { content: string; minimal: number }[] = [];
  node?.content?.split(" ").forEach((item) => {
    if (!item) {
      return;
    }
    const matched = item.match(token);
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
  readonly groups: Record<string, string[] | undefined> = {};
  readonly tags: Record<string, string | undefined> = {};
  readonly nonDag: string[] = [];
  readonly dfsPath: string[] = [];
  readonly bfsPath: string[] = [];
  readonly nodes: string[] = [];
  readonly marks: string[] = [];
  readonly plugins: string[] = [];

  constructor(
    public readonly extensions: Extensions,
    public readonly tagPrecedence = defaultTagPrecedence
  ) {
    this.init();
    this.detectDAG();
    this.detectInfinity();
    this.sortDeps();
    this.sortExtensions();
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
        (this.getExtension(name) as NodeExtension).node,
      ])
    );

    const marks: Record<string, MarkSpec> = Object.fromEntries(
      this.marks.map((name) => [
        name,
        (this.getExtension(name) as MarkExtension).mark,
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
    const allPlugins: Plugin[] = [];
    const engine = schema.cached.engine;

    // plugin keys from low priority to high
    const keys = [...this.nodes, ...this.marks, ...this.plugins];

    for (let i = 0; i < keys.length; ++i) {
      // since Prosemirror use plugins via first-come-first-served,
      // so we adding by reverse order, i.e. from special to general
      const key = keys[keys.length - i - 1];
      const nodeType = schema.nodes[key];
      const markType = schema.marks[key];
      const { plugins = [], rule = {} } = this.getExtension(key) || {};

      let thisPlugins: Plugin[] = [];
      if (typeof plugins === "function") {
        const type = nodeType || markType;
        thisPlugins = (plugins as ExtensionPlugins<typeof type>)(type);
      } else {
        thisPlugins = plugins;
      }

      allPlugins.push(...thisPlugins);

      const { handle, alt, postHandle } = rule;
      if (handle) {
        const rule = { name: key, handle, alt };
        if (nodeType) {
          engine.block.ruler.add(rule as BlockRule);
        } else if (markType) {
          engine.inline.ruler.add(rule as InlineRule);
        }
      }
      if (postHandle) {
        engine.postInline.ruler.add({ name: key, handle: postHandle });
      }
    }

    return allPlugins;
  }

  private getExtension = (name: string): Extension | undefined =>
    this.extensions[name];

  private init() {
    for (const name in this.extensions) {
      const extension = this.getExtension(name);
      const node: NodeSpec | undefined = (extension as NodeExtension).node;
      const mark: MarkSpec | undefined = (extension as MarkExtension).mark;

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

      const tag = this.getTag(node || mark);
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

  private sortExtensions() {
    for (const name of this.bfsPath) {
      const extension = this.getExtension(name);
      if (!extension) {
        continue;
      }

      const node: NodeSpec | undefined = (extension as NodeExtension).node;
      const mark: MarkSpec | undefined = (extension as MarkExtension).mark;

      if (node) {
        this.nodes.push(name);
      } else if (mark) {
        this.marks.push(name);
      } else {
        this.plugins.push(name);
      }
    }

    // the nodes had been sorted by dfs/bfs

    this.marks.sort((a, b) => {
      const aTag = this.getTag((this.getExtension(a) as MarkExtension).mark);
      const bTag = this.getTag((this.getExtension(b) as MarkExtension).mark);
      return this.tagSorter(aTag, bTag);
    });

    // TODO: sort plugins
  }

  private getTag(props?: { parseDOM?: ParseRule[] | null }) {
    const rules = props?.parseDOM;

    if (rules) {
      for (const { tag } of rules) {
        if (tag) {
          return tag;
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
