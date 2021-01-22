import { Node as ProsemirrorNode, NodeType } from "prosemirror-model";
import { EditorView } from "prosemirror-view";

import { ExtensionPlugin } from "../../../editor";

import { NodeView } from "./view";

class HtmlPlugin extends ExtensionPlugin {
  createNodeView = (
    node: ProsemirrorNode,
    view: EditorView,
    getPos: boolean | (() => number)
  ) => new NodeView(node, view, getPos as () => number);
}

export default function plugins(type: NodeType) {
  return [new HtmlPlugin(type)];
}
