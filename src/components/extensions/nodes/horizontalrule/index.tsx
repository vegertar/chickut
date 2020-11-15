import { InputRule, inputRules } from "prosemirror-inputrules";
import { NodeSpec, NodeType } from "prosemirror-model";

import { useExtension } from "../../../editor";

import "./style.scss";

export default function HorizontalRule() {
  useExtension(HorizontalRule);

  return null;
}

HorizontalRule.node = {
  group: "block",
  parseDOM: [{ tag: "hr" }],
  toDOM: () => ["hr"],
} as NodeSpec;

HorizontalRule.plugins = (type: NodeType) => [
  inputRules({
    rules: [
      new InputRule(/^(?:---|___\s|\*\*\*\s)$/, (state, match, start, end) => {
        const { tr } = state;

        if (match[0]) {
          tr.replaceWith(start - 1, end, type.create({}));
        }

        return tr;
      }),
    ],
  }),
];
