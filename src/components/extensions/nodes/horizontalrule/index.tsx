import { NodeExtension, useTextExtension } from "../../../editor";

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

export default function HorizontalRule(props?: { text?: string }) {
  useTextExtension(extension, props?.text);
  return null;
}
