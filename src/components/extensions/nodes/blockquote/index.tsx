import { NodeExtension, useExtension } from "../../../editor";

import handle from "./handle";

import "./style.scss";

const name = "blockquote";
const extension: NodeExtension = {
  rule: {
    handle,
    alt: ["paragraph", "reference", ".", "list"],
  },

  node: {
    content: "block+",
    group: "block",
    defining: true,
    parseDOM: [{ tag: name }],
    toDOM: () => [name, 0],
  },
};

export default function Blockquote() {
  useExtension(extension, name);
  return null;
}
