import { NodeExtension, useExtension } from "../../../editor";
import handle from "./handle";
import plugins from "./plugins";

import "./style.scss";

const extension: NodeExtension = {
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
  },
};

export default function CodeBlock() {
  useExtension(extension);
  return null;
}
