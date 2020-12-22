import { NodeExtension, useTextExtension } from "../../../editor";
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

export default function Blockquote(props?: { text?: string }) {
  useTextExtension(extension, props?.text);
  return null;
}
