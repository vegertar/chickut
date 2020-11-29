import { NodeSpec, NodeType } from "prosemirror-model";
import { textblockTypeInputRule } from "prosemirror-inputrules";
import { inputRules } from "prosemirror-inputrules";
import range from "lodash.range";

import { useExtension } from "../../../editor";

import "./style.scss";

export default function Heading() {
  useExtension(Heading);
  return null;
}

Heading.node = {
  attrs: {
    level: {
      default: 1,
    },
  },
  content: "inline*",
  group: "block",
  defining: true,
  draggable: false,
  parseDOM: range(1, 7).map((level) => ({
    tag: `h${level}`,
    attrs: { level },
  })),
  toDOM: (node) => [`h${node.attrs.level}`, 0],
} as NodeSpec;

Heading.plugins = (type: NodeType) => [
  inputRules({
    rules: range(1, 7).map((level) =>
      textblockTypeInputRule(new RegExp(`^(#{1,${level}})\\s$`), type, () => ({
        level,
      }))
    ),
  }),
];
