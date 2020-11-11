import { useContext, useEffect, useState } from "react";
import OrderedMap from "orderedmap";
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
  MarkSpec as ProsemirrorMarkSpec,
  NodeSpec as ProsemirrorNodeSpec,
  SchemaSpec as ProsemirrorSchemaSpec,
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

export type PluginSpec = ProsemirrorPluginSpec<unknown, Schema>;
export type Plugin = ProsemirrorPlugin<unknown, Schema>;
/* eslint-disable-next-line @typescript-eslint/no-redeclare */
export const Plugin = ProsemirrorPlugin;

export type Transaction = ProsemirrorTransaction<Schema>;
/* eslint-disable-next-line @typescript-eslint/no-redeclare */
export const Transaction = ProsemirrorTransaction;

export function useExtension(extension: NodeExtensions[N] | MarkExtensions[M]) {
  const { view, dispatch } = useContext(EditorContext);
  const [status, setStatus] = useState<boolean>();

  useEffect(() => {
    if (!view) {
      return;
    }

    const editorView = view as EditorView<Schema>;

    const name = extension.name.toLowerCase();
    const node:
      | ProsemirrorNodeSpec
      | undefined = (extension as NodeExtensions[N]).node;
    const mark:
      | ProsemirrorMarkSpec
      | undefined = (extension as MarkExtensions[M]).mark;

    type NodeMap = OrderedMap<ProsemirrorNodeSpec>;
    type MarkMap = OrderedMap<ProsemirrorMarkSpec>;

    const spec = editorView.state.schema.spec;
    const nodes = node ? { [name]: node } : {};
    const marks = mark ? { [name]: mark } : {};

    try {
      editorView.updateState(
        // TODO: the new created state will discard all history
        EditorState.create({
          schema: new Schema({
            nodes: (spec.nodes as NodeMap).append(nodes),
            marks: (spec.marks as MarkMap).append(marks),
          } as SchemaSpec),
          plugins: editorView.state.plugins,
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
              plugins: editorView.state.plugins,
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
