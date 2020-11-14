import { useContext, useEffect, useState } from "react";
import OrderedMap from "orderedmap";
import difference from "lodash.difference";
import { EditorView } from "prosemirror-view";
import { Plugin, EditorState } from "prosemirror-state";
import {
  Schema,
  SchemaSpec,
  NodeType,
  MarkType,
  NodeSpec,
  MarkSpec,
} from "prosemirror-model";

import { Context as EditorContext } from "../editor";

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
