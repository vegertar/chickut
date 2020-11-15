import { inputRules, wrappingInputRule } from "prosemirror-inputrules";
import { NodeSpec, NodeType } from "prosemirror-model";

import { useExtension } from "../../../editor";

import "./style.scss";

export default function Blockquote() {
  useExtension(Blockquote);

  return null;
}

Blockquote.node = {
  content: "block+",
  group: "block",
  defining: true,
  parseDOM: [{ tag: "blockquote" }],
  toDOM: () => ["blockquote", 0],
} as NodeSpec;

Blockquote.plugins = (type: NodeType) => [
  inputRules({
    rules: [wrappingInputRule(/^\s*>\s$/, type)],
  }),
];
