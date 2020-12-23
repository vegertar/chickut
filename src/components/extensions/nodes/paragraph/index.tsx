import { NodeExtension, useTextExtension } from "../../../editor";

import handle from "./handle";
import plugins from "./plugins";

import "./style.scss";

const extension: NodeExtension = {
  plugins,

  rule: {
    handle,
  },

  node: {
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: "p" }],
    toDOM: () => ["p", 0],
  },
};

export default function Paragraph(props?: { text?: string }) {
  useTextExtension(extension, props?.text);
  return null;
}
