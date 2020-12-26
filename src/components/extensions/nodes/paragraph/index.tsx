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
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: "p" }],
    toDOM: () => ["p", 0],
  },
};

export default function Paragraph() {
  useExtension(extension);
  return null;
}
