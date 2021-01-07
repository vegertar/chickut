import { MarkExtension, useExtension } from "../../../editor";

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
        getAttrs: (node) => {
          const dom = node as HTMLAnchorElement;
          const attrs: { href: string; title?: string } = {
            href: dom.getAttribute("href")!,
          };
          const title = dom.getAttribute("title");
          if (title) {
            attrs.title = title;
          }
          return attrs;
        },
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
