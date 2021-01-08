import { getAttrs, MarkExtension, useExtension } from "../../../editor";

import handle from "./handle";

const extension: MarkExtension = {
  rule: {
    handle,
  },

  mark: {
    attrs: {
      href: {},
      title: { default: null },
    },
    // inclusive: false,
    parseDOM: [
      {
        tag: "a[href]",
        getAttrs: (node) => getAttrs(node as Element),
      },
    ],
    toDOM: ({ attrs }) => ["a", attrs],
    toText: ({ attrs }, s) =>
      `[${s}](${attrs.href}${attrs.title ? ` "${attrs.title}"` : ""})`,
  },
};

export default function Link() {
  useExtension(extension, "link");
  return null;
}
