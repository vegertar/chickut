import React, { useContext, useEffect } from "react";
import OrderedMap from "orderedmap";
import { TokenConfig } from "prosemirror-markdown";
import { EditorView } from "prosemirror-view";
import {
  Transaction as ProsemirrorTransaction,
  Plugin as ProsemirrorPlugin,
  PluginSpec as ProsemirrorPluginSpec,
} from "prosemirror-state";
import {
  Schema as ProsemirrorSchema,
  MarkSpec as ProsemirrorMarkSpec,
  NodeSpec as ProsemirrorNodeSpec,
  SchemaSpec as ProsemirrorSchemaSpec,
} from "prosemirror-model";

export interface NodeSpecs {}
export interface MarkSpecs {}

type N = keyof NodeSpecs;
type M = keyof MarkSpecs;

export type NodeTokens = { [name in N]: TokenConfig };
export type MarkTokens = { [name in M]: TokenConfig };

export type SchemaSpec = ProsemirrorSchemaSpec<N, M>;
export type Schema = ProsemirrorSchema<N, M>;
/* eslint-disable-next-line @typescript-eslint/no-redeclare */
export const Schema = ProsemirrorSchema;

export type PluginSpec = ProsemirrorPluginSpec<unknown, Schema>;
export type Plugin = ProsemirrorPlugin<unknown, Schema>;
/* eslint-disable-next-line @typescript-eslint/no-redeclare */
export const Plugin = ProsemirrorPlugin;

export type Transaction = ProsemirrorTransaction<Schema>;
/* eslint-disable-next-line @typescript-eslint/no-redeclare */
export const Transaction = ProsemirrorTransaction;

export const Context = React.createContext<{
  view?: EditorView<Schema>;
}>({});

export function useExtension(
  nodes: Partial<NodeSpecs> | null,
  marks: Partial<MarkSpecs> | null,
  tokens: Partial<NodeTokens> | Partial<MarkSpecs>
) {
  const { view } = useContext(Context);

  useEffect(() => {
    if (!view) {
      return;
    }

    type NodeMap = OrderedMap<ProsemirrorNodeSpec>;
    type MarkMap = OrderedMap<ProsemirrorMarkSpec>;

    const spec = view.state.schema.spec;

    view.updateState(
      view.state.reconfigure({
        schema: new Schema({
          nodes: (spec.nodes as NodeMap).append((nodes as any) || {}),
          marks: (spec.marks as MarkMap).append((marks as any) || {}),
        } as SchemaSpec),
        plugins: view.state.plugins,
      })
    );

    return () => {
      const spec = view.state.schema.spec;

      view.updateState(
        view.state.reconfigure({
          schema: new Schema({
            nodes: (spec.nodes as NodeMap).subtract((nodes as any) || {}),
            marks: (spec.marks as MarkMap).subtract((marks as any) || {}),
          } as SchemaSpec),
          plugins: view.state.plugins,
        })
      );
    };
  }, [nodes, marks, view]);

  return view;
}
