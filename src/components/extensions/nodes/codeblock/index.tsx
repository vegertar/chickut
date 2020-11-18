import { useEffect, useState } from "react";
import React, { NodeSpec, NodeType } from "prosemirror-model";
import { inputRules, textblockTypeInputRule } from "prosemirror-inputrules";
import { Parser, Node as AcornNode } from "acorn";

import { useExtension, Extension } from "../../../editor";

import "./style.scss";

const CodeParser = Parser.extend(require("acorn-jsx")());

function parse(code?: string) {
  return CodeParser.parse(code || "", { ecmaVersion: "latest" });
}

export default function CodeBlock() {
  const { node } = useExtension(CodeBlock);
  const textContent = node?.textContent;
  const [result, setResult] = useState<string>();

  useEffect(() => {
    try {
      const v = parse(textContent);
      setResult(JSON.stringify(v, null, 2));
    } catch (e) {
      if (e instanceof SyntaxError) {
        setResult(e.message);
      }
    }
  }, [textContent]);

  return (
    <Extension>
      <pre>{result}</pre>
    </Extension>
  );
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
