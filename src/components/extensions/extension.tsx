import React, { useContext, useEffect, useMemo, useState } from "react";
import OrderedMap from "orderedmap";
import difference from "lodash.difference";
import { TokenConfig } from "prosemirror-markdown";
import { EditorView } from "prosemirror-view";
import {
  Transaction as ProsemirrorTransaction,
  Plugin as ProsemirrorPlugin,
  PluginSpec as ProsemirrorPluginSpec,
  EditorState,
} from "prosemirror-state";
import {
  Schema as ProsemirrorSchema,
  SchemaSpec as ProsemirrorSchemaSpec,
  NodeType as ProsemirrorNodeType,
  MarkType as ProsemirrorMarkType,
  NodeSpec,
  MarkSpec,
} from "prosemirror-model";

import { Context as EditorContext } from "../editor";

export interface NodeExtensions {}
export interface MarkExtensions {}

type N = keyof NodeExtensions;
type M = keyof MarkExtensions;

export type NodeTokens = { [name in N]: TokenConfig };
export type MarkTokens = { [name in M]: TokenConfig };

export type SchemaSpec = ProsemirrorSchemaSpec<N, M>;
export type Schema = ProsemirrorSchema<N, M>;
/* eslint-disable-next-line @typescript-eslint/no-redeclare */
export const Schema = ProsemirrorSchema;

export type NodeType = ProsemirrorNodeType<Schema>;
/* eslint-disable-next-line @typescript-eslint/no-redeclare */
export const NodeType = ProsemirrorNodeType;

export type MarkType = ProsemirrorMarkType<Schema>;
/* eslint-disable-next-line @typescript-eslint/no-redeclare */
export const MarkType = ProsemirrorMarkType;

export type PluginSpec = ProsemirrorPluginSpec<unknown, Schema>;
export type Plugin = ProsemirrorPlugin<unknown, Schema>;
/* eslint-disable-next-line @typescript-eslint/no-redeclare */
export const Plugin = ProsemirrorPlugin;

export type Transaction = ProsemirrorTransaction<Schema>;
/* eslint-disable-next-line @typescript-eslint/no-redeclare */
export const Transaction = ProsemirrorTransaction;

type Base = {
  name: string;
};

export type NodeExtension = (NodeExtensions[N] | Base) & {
  node: NodeSpec;
};

export type MarkExtension = (MarkExtensions[M] | Base) & {
  mark: MarkSpec;
};

export type PluginExtension = Base & {
  plugins: Plugin[] | ((type: NodeType | MarkType) => Plugin[]);
};

export type Extension = NodeExtension | MarkExtension | PluginExtension;

export function useExtension(extension: Extension) {
  const { view, dispatch } = useContext(EditorContext);
  const [status, setStatus] = useState<boolean>();

  useEffect(() => {
    if (!view) {
      return;
    }

    const editorView = view as EditorView<Schema>;

    const name = extension.name.toLowerCase();
    const node: NodeSpec | undefined = (extension as NodeExtension).node;
    const mark: MarkSpec | undefined = (extension as MarkExtension).mark;

    type NodeMap = OrderedMap<NodeSpec>;
    type MarkMap = OrderedMap<MarkSpec>;

    const spec = editorView.state.schema.spec;
    const nodes = node ? { [name]: node } : {};
    const marks = mark ? { [name]: mark } : {};
    const plugins = (extension as PluginExtension).plugins || [];

    try {
      const schema = new Schema({
        nodes: (spec.nodes as NodeMap).append(nodes),
        marks: (spec.marks as MarkMap).append(marks),
      } as SchemaSpec);

      let thisPlugins: Plugin[] = [];
      if (typeof plugins === "function") {
        thisPlugins = plugins(node ? schema.nodes[name] : schema.marks[name]);
      } else {
        thisPlugins = plugins;
      }

      editorView.updateState(
        // TODO: the new created state will discard all history
        EditorState.create({
          schema,
          plugins: editorView.state.plugins.concat(...thisPlugins),
        })
      );

      dispatch?.("load", name);
      setStatus(true);

      return () => {
        const spec = editorView.state.schema.spec;

        try {
          editorView.updateState(
            // TODO: the new created state will discard all history
            EditorState.create({
              schema: new Schema({
                nodes: (spec.nodes as NodeMap).subtract(nodes),
                marks: (spec.marks as MarkMap).subtract(marks),
              } as SchemaSpec),
              plugins: difference(editorView.state.plugins, thisPlugins),
            })
          );

          dispatch?.("off-load", name);
        } catch (e) {
          dispatch?.("off-load", name, e);
        }
      };
    } catch (e) {
      dispatch?.("load", name, e);
      setStatus(false);
    }
  }, [extension, view, dispatch]);

  return { status, view };
}

export function useTreeView(
  extensions: Record<string, Extension>,
  className = "tree-view"
) {
  type Dependency = { group: string; required: boolean };
  type DfsStatus = { [group: string]: undefined | 1 | 2 };

  const view = useMemo(() => {
    const groups: Record<string, Extension[]> = {};
    const dependencies: Record<string, Dependency[]> = {};
    const visited: DfsStatus = {};
    const dag: string[] = [];

    const word = /(\w+)(\+)?/;
    const parseDependencies = (node?: NodeSpec) => {
      const result = (node?.content || "").match(word);
      if (result) {
        const group = result[1];
        const required = !!result[2];
        return [{ group, required }];
      }
      return [];
    };

    const dfs = (group: string) => {
      const status = visited[group];
      if (status === 1) {
        // is not a DAG
        return;
      }

      if (!status) {
        visited[group] = 1;
        for (let dep of dependencies[group]) {
          dfs(dep.group);
        }
        visited[group] = 2;
        dag.push(group);
      }
    };

    for (let name in extensions) {
      const extension = extensions[name] as NodeExtension;
      const node: NodeSpec | undefined = extension.node;
      const group = node?.group || name.toLowerCase();

      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(extension);

      if (!dependencies[group]) {
        dependencies[group] = [];
      }
      dependencies[group].push(...parseDependencies(node));
    }

    for (let group in dependencies) {
      if (!visited[group]) {
        dfs(group);
      }
    }

    const made: Record<string, boolean> = {};
    const makeTree = (group: string) => {
      made[group] = true;

      return (
        <ul key={group}>
          {groups[group]?.map((item) => {
            const name = item.name.toLowerCase();

            return (
              <li key={name}>
                <span data-is-extension={name}>{name}</span>
                {dependencies[group]?.map((dep) => makeTree(dep.group))}
              </li>
            );
          })}
        </ul>
      );
    };

    return (
      <div className={className}>
        {dag.reverse().map((group) => (made[group] ? null : makeTree(group)))}
      </div>
    );
  }, [extensions, className]);

  return view;
}
