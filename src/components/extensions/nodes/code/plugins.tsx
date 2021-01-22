import { Node as ProsemirrorNode, NodeType } from "prosemirror-model";
import { EditorView } from "prosemirror-view";
import { inputRules, textblockTypeInputRule } from "prosemirror-inputrules";

import { ExtensionPlugin } from "../../../editor";

import { NodeView } from "./view";

class CodePlugin extends ExtensionPlugin {
  createNodeView = (
    node: ProsemirrorNode,
    view: EditorView,
    getPos: boolean | (() => number)
  ) => new NodeView(node, view, getPos as () => number);
}

// since markdown do not work on empty lines, so use input rule to enable very first code node when typing
const plugins = (type: NodeType) => [
  // TODO: remove this input rule
  // inputRules({
  //   rules: [textblockTypeInputRule(/^ {4}$/, type)],
  // }),
  new CodePlugin(type),
];

export default plugins;
