import { Node, NodeType } from "prosemirror-model";

import { ExtensionPlugin } from "../../../editor";

import { NodeView } from "./view";

class HtmlPlugin extends ExtensionPlugin {
  createNodeView = (node: Node) => new NodeView(node);
}

export default function plugins(type: NodeType) {
  return [new HtmlPlugin(type)];
}
