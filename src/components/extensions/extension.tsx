import React, { useContext, useEffect } from "react";
import OrderedMap from "orderedmap";
import { TokenConfig, MarkdownParser } from "prosemirror-markdown";
import { EditorView } from "prosemirror-view";
import { EditorState, Transaction } from "prosemirror-state";
import {
  Schema as ProsemirrorSchema,
  MarkSpec as ProsemirrorMarkSpec,
  NodeSpec as ProsemirrorNodeSpec,
  SchemaSpec as ProsemirrorSchemaSpec,
} from "prosemirror-model";

export interface NodeSpecs {}
export interface MarkSpecs {}

export type NodeTokens = { [name in keyof NodeSpecs]: TokenConfig };
export type MarkTokens = { [name in keyof MarkSpecs]: TokenConfig };

export type SchemaSpec = ProsemirrorSchemaSpec<
  keyof NodeSpecs,
  keyof MarkSpecs
>;
export type Schema = ProsemirrorSchema<keyof NodeSpecs, keyof MarkSpecs>;
/* eslint-disable-next-line @typescript-eslint/no-redeclare */
export const Schema = ProsemirrorSchema;

export type Action = {
  state?: EditorState<Schema>;
  transactions?: Transaction<Schema>[];
};

export const Context = React.createContext<{
  view?: EditorView<Schema>;
  dispatch?: React.Dispatch<Action>;
}>({});

export function useExtension(
  nodes: Partial<NodeSpecs> | null,
  marks: Partial<MarkSpecs> | null,
  tokens: Partial<NodeTokens> | Partial<MarkSpecs>
) {
  const { view, dispatch } = useContext(Context);

  // TODO: debounce
  useEffect(() => {
    if (!view || !dispatch) {
      return;
    }

    console.log("loading extension:", nodes, marks);

    type NodeMap = OrderedMap<ProsemirrorNodeSpec>;
    type MarkMap = OrderedMap<ProsemirrorMarkSpec>;

    const spec = view.state.schema.spec;

    dispatch({
      state: view.state.reconfigure({
        schema: new Schema({
          nodes: (spec.nodes as NodeMap).append((nodes as any) || {}),
          marks: (spec.marks as MarkMap).append((marks as any) || {}),
        } as SchemaSpec),
      }),
    });

    return () => {
      const spec = view.state.schema.spec;

      dispatch({
        state: view.state.reconfigure({
          schema: new Schema({
            nodes: (spec.nodes as NodeMap).subtract((nodes as any) || {}),
            marks: (spec.marks as MarkMap).subtract((marks as any) || {}),
          } as SchemaSpec),
        }),
      });
    };
  }, [nodes, marks, view, dispatch]);
}
