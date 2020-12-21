import { NodeSpec } from "prosemirror-model";

import { useTextExtension } from "../../../editor";
import handle from "./handle";
import plugins from "./plugins";

import "./style.scss";

const extension = {
  plugins,

  rule: {
    handle,
  },

  node: {
    content: "text*",
    marks: "",
    group: "block",
    code: true,
    defining: true,
    draggable: false,
    parseDOM: [
      {
        tag: "pre",
        preserveWhitespace: "full",
        contentElement: "code",
      },
    ],
    toDOM: (node) => [
      "pre",
      { "data-language": node.attrs.language },
      ["code", 0],
    ],
  } as NodeSpec,
};

export default function CodeBlock(props?: { text?: string }) {
  useTextExtension(extension, props?.text);
  return null;
}
