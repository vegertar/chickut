import { getAttrs, NodeExtension, useExtension } from "../../../editor";

import handle from "./handle";

const extension: NodeExtension = {
  rule: {
    handle,
  },

  node: {
    attrs: {
      src: {},
      alt: { default: "" },
      title: { default: null },
    },
    inline: true,
    group: "inline",
    parseDOM: [
      { tag: "img[src]", getAttrs: (node) => getAttrs(node as Element) },
    ],
    toDOM: ({ attrs }) => ["img", attrs],
  },
};

export default function Image() {
  useExtension(extension, "image");
  return null;
}
