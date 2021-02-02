import { NodeType } from "prosemirror-model";
//import { inputRules, textblockTypeInputRule } from "prosemirror-inputrules";

import { NodeViewPlugin } from "../../../editor";

import { NodeView } from "./view";

// since markdown do not work on empty lines, so use input rule to enable very first code node when typing
const plugins = (type: NodeType) => [
  // TODO: remove this input rule
  // inputRules({
  //   rules: [textblockTypeInputRule(/^ {4}$/, type)],
  // }),
  new NodeViewPlugin(type, NodeView),
];

export default plugins;
