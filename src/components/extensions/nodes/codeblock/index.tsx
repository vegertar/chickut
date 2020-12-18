import React from "react";
import { NodeSpec, NodeType } from "prosemirror-model";
import { inputRules, textblockTypeInputRule } from "prosemirror-inputrules";

import { useExtension, Extension } from "../../../editor";

import "./style.scss";

export default function CodeBlock() {
  const { extensionView } = useExtension(CodeBlock);
  // const textContent = extensionView?.node.textContent;

  return null;
}

CodeBlock.node = {
  attrs: {
    language: {
      default: "javascript",
    },
  },
  content: "text*",
  marks: "",
  group: "block",
  code: true,
  defining: true,
  draggable: false,
  parseDOM: [
    { tag: "pre", preserveWhitespace: "full" },
    {
      tag: ".codeblock",
      preserveWhitespace: "full",
      contentElement: "code",
      getAttrs: (node) => ({
        language: (node as HTMLElement).dataset.language,
      }),
    },
  ],
  toDOM: (node) => [
    "div",
    { class: "codeblock", "data-language": node.attrs.language },
    ["pre", ["code", { spellCheck: "false" }, 0]],
  ],
} as NodeSpec;

CodeBlock.plugins = (type: NodeType) => [
  inputRules({
    rules: [textblockTypeInputRule(/^```$/, type)],
  }),
];
