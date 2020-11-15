import { inputRules, wrappingInputRule } from "prosemirror-inputrules";
import { NodeSpec, NodeType } from "prosemirror-model";

import { useExtension } from "../../../editor";

import "./style.scss";

export default function NumberedList() {
  useExtension(NumberedList);

  return null;
}

NumberedList.node = {
  attrs: {
    order: {
      default: 1,
    },
  },
  content: "listitem+",
  group: "block",
  parseDOM: [
    {
      tag: "ol",
      getAttrs: (dom: Node) => ({
        order: parseInt((dom as HTMLElement).getAttribute("start") || "1", 10),
      }),
    },
  ],
  toDOM: (node) =>
    node.attrs.order === 1 ? ["ol", 0] : ["ol", { start: node.attrs.order }, 0],
} as NodeSpec;

NumberedList.plugins = (type: NodeType) => [
  inputRules({
    rules: [
      wrappingInputRule(
        /^(\d+)\.\s$/,
        type,
        (match) => ({ order: +match[1] }),
        (match, node) => node.childCount + node.attrs.order === +match[1]
      ),
    ],
  }),
];
