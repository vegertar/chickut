import { NodeType } from "prosemirror-model";

import { NodeViewPlugin } from "../../../editor";

import { NodeView } from "./view";

export default function plugins(type: NodeType) {
  return [new NodeViewPlugin(type, NodeView)];
}
