import { inputRules, textblockTypeInputRule } from "prosemirror-inputrules";
import { NodeType } from "prosemirror-model";

// since markdown do not work on empty line, so use input rule to enable very first codeblock type when typing
const plugins = (type: NodeType) => [
  inputRules({
    rules: [textblockTypeInputRule(/^ {4}$/, type)],
  }),
];

export default plugins;
