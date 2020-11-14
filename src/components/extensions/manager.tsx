import React, { useMemo } from "react";
import { NodeSpec } from "prosemirror-model";

import { Extension, NodeExtension } from "./extension";

export function useTreeView(
  extensions: Record<string, Extension>,
  className = "tree-view"
) {
  type Dependency = { content: string; required: boolean };
  type DfsStatus = { [group: string]: undefined | 1 | 2 };

  const view = useMemo(() => {
    const groups: Record<string, string[]> = {};
    const dependencies: Record<string, Dependency[]> = {};
    const visited: DfsStatus = {};
    const dag: string[] = [];

    const word = /(\w+)(\+)?/;
    const parseDependencies = (node?: NodeSpec) => {
      const result = (node?.content || "").match(word);
      if (result) {
        const content = result[1];
        const required = !!result[2];
        return [{ content, required }];
      }
      return [];
    };
    const dfs = (name: string) => {
      const status = visited[name];
      if (status === 1) {
        // is not a DAG
        return;
      }

      if (!status) {
        visited[name] = 1;
        const grouped = groups[name];
        if (grouped) {
          for (let item of grouped) {
            dfs(item);
          }
        } else {
          for (let dep of dependencies[name]) {
            dfs(dep.content);
          }
        }
        visited[name] = 2;
        dag.push(name);
      }
    };

    for (let key in extensions) {
      const extension = extensions[key] as NodeExtension;
      const node: NodeSpec | undefined = extension.node;
      const group = node?.group;
      const name = key.toLowerCase();

      if (group) {
        if (!groups[group]) {
          groups[group] = [];
        }
        groups[group].push(name);
      }

      if (!dependencies[name]) {
        dependencies[name] = [];
      }
      dependencies[name].push(...parseDependencies(node));
    }

    for (let name in dependencies) {
      if (!visited[name]) {
        dfs(name);
      }
    }

    const made: Record<string, boolean> = {};
    const makeTree = (name: string) => {
      made[name] = true;
      const grouped = groups[name];
      if (grouped) {
        return (
          <ul key={name} data-is-group={name}>
            {grouped.map((item) => makeTree(item))}
          </ul>
        );
      }

      const deps = dependencies[name];
      return (
        <li key={name}>
          <span data-is-extension={name}>{name}</span>
          {deps.map((item) => makeTree(item.content))}
        </li>
      );
    };

    return (
      <ul className={className}>
        {dag.reverse().map((name) => (made[name] ? null : makeTree(name)))}
      </ul>
    );
  }, [extensions, className]);

  return view;
}
