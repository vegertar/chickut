import { NodeExtension, useExtension } from "../../../editor";

import handle from "./handle";

import "./style.scss";

const extension: NodeExtension = {
  rule: {
    handle,
    alt: ["paragraph", "reference", "blockquote", "list"],
  },

  node: {
    group: "block",
    parseDOM: [{ tag: "hr" }],
    toDOM: () => ["hr"],
  },
};

export default function HorizontalRule() {
  useExtension(extension);
  return null;
}
