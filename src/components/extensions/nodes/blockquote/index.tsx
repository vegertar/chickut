// import { inputRules, wrappingInputRule } from "prosemirror-inputrules";
// import { NodeSpec, NodeType } from "prosemirror-model";

import { useExtension, NodeExtension } from "../../../editor";
import handle from "./handle";

import "./style.scss";

const extension: NodeExtension = {
  rule: {
    handle,
    alt: ["paragraph", "reference", ".", "list"],
  },

  node: {
    content: "block+",
    group: "block",
    defining: true,
    parseDOM: [{ tag: "blockquote" }],
    toDOM: () => ["blockquote", 0],
  },
};

export default function Blockquote() {
  useExtension(extension);

  return null;
}

// Blockquote.plugins = (type: NodeType) => [
//   inputRules({
//     rules: [wrappingInputRule(/^\s*>\s$/, type)],
//   }),
// ];
