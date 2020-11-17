import {
  NodeSpec,
  Schema,
  MarkSpec,
  NodeType,
  MarkType,
} from "prosemirror-model";
import { Plugin } from "prosemirror-state";

type Plugins = Plugin[] | ((type: NodeType | MarkType) => Plugin[]);

type Base = {
  name: string;
};

export type NodeExtension = Base & {
  node: NodeSpec;
};

export type MarkExtension = Base & {
  mark: MarkSpec;
};

export type PluginExtension = Base & {
  plugins: Plugins;
};

export type Extension = NodeExtension | MarkExtension | PluginExtension;

export interface Events {
  load: {
    id: string;
    extension: Extension;
  };
  ["off-load"]: string;
}

export interface EventHandler {
  <T extends keyof Events>(event: T, target: string, data: Events[T]): void;
}

const content = /(\w+)(\+)?/;
const parseDeps = (node?: NodeSpec) => {
  const result = (node?.content || "").match(content);
  if (result) {
    const content = result[1];
    const required = !!result[2];
    return [{ content, minimal: required ? 1 : 0 }];
  }
  return [];
};

type Extensions = Record<string, Events["load"][]>;
type Dependency = { content: string; minimal?: number };

type DfsStatus = undefined | 1 | 2;
type Visited = Record<string, DfsStatus>;

export default class Manager {
  readonly deps: Record<string, Dependency[]> = {};
  readonly groups: Record<string, string[]> = {};
  readonly nonDag: string[] = [];
  readonly dfsPath: string[] = [];
  readonly bfsPath: string[] = [];

  constructor(public readonly extensions: Extensions) {
    this.init();

    const dfsVisited: Visited = {};
    for (const name in extensions) {
      if (!dfsVisited[name]) {
        this.dfs(name, dfsVisited);
      }
    }

    this.sortGroups();
    this.detectInfinity();

    const bfsVisited: Visited = {};
    for (let i = this.dfsPath.length - 1; i >= 0; --i) {
      const name = this.dfsPath[i];
      if (!bfsVisited[name]) {
        this.bfs(name, bfsVisited);
      }
    }
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

    this.eachExtension((extension, name) => {
      const plugins = (extension as PluginExtension).plugins || [];

      let thisPlugins: Plugin[] = [];
      if (typeof plugins === "function") {
        thisPlugins = plugins(schema.nodes[name] || schema.marks[name]);
      } else {
        thisPlugins = plugins;
      }
      allPlugins.push(...thisPlugins);
    });

    return { schema, plugins: allPlugins };
  }

  eachExtension = (fn: (extension: Extension, name: string) => void) => {
    for (const name of this.bfsPath) {
      if (!this.groups[name]) {
        fn(this.getExtension(name), name);
      }
    }
  };

  // only use the first extension at present
  private getExtension = (name: string) => this.extensions[name][0].extension;

  private init = () => {
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
    }
  };

  private sortGroups = () => {
    for (const group in this.groups) {
      this.groups[group].sort((a, b) => {
        const aDeps = this.deps[a];
        const bDeps = this.deps[b];
        if (!aDeps || aDeps.length === 0) {
          return -1;
        }
        if (!bDeps || bDeps.length === 0) {
          return 1;
        }
        return 0;
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
        throw new Error(`missing content: ${name}`);
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
