import { NodeExtension, useExtension } from "../../../editor";

import handle from "./handle";

import "./style.scss";

const extension: NodeExtension = {
  rule: {
    handle,
    alt: ["paragraph", "reference", "blockquote", "list"],
  },

  node: {
    content: "text*",
    group: "block",
    parseDOM: [{ tag: "hr" }],
    toDOM: () => ["hr", 0],
  },
};

export default function HorizontalRule() {
  useExtension(extension, "horizontalrule");
  return null;
}
