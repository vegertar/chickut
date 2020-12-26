import range from "lodash.range";

import { NodeExtension, useExtension } from "../../../editor";

import handle from "./handle";

import "./style.scss";

const extension: NodeExtension = {
  rule: {
    handle,
    alt: ["paragraph", "reference", "blockquote"],
  },

  node: {
    attrs: {
      level: {
        default: 1,
      },
    },
    content: "inline*",
    group: "block",
    defining: true,
    draggable: false,
    parseDOM: range(1, 7).map((level) => ({
      tag: `h${level}`,
      attrs: { level },
    })),
    toDOM: (node) => [`h${node.attrs.level}`, 0],
  },
};

export default function Heading() {
  useExtension(extension);
  return null;
}
