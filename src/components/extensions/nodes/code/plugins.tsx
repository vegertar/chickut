import { inputRules, textblockTypeInputRule } from "prosemirror-inputrules";
import { NodeType } from "prosemirror-model";

// since markdown do not work on empty lines, so use input rule to enable very first code node when typing
const plugins = (type: NodeType) => [
  inputRules({
    rules: [textblockTypeInputRule(/^ {4}$/, type)],
  }),
];

export default plugins;
