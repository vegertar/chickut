import { NodeExtension, useExtension } from "../../../editor";

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
    group: "inline",
    parseDOM: [
      {
        tag: "img[src]",
        getAttrs: (node) => {
          const dom = node as HTMLImageElement;
          const attrs: { src: string; alt?: string; title?: string } = {
            src: dom.getAttribute("src")!,
          };
          const alt = dom.getAttribute("alt");
          if (alt) {
            attrs.alt = alt;
          }
          const title = dom.getAttribute("title");
          if (title) {
            attrs.title = title;
          }
          return attrs;
        },
      },
    ],
    toDOM: ({ attrs }) => ["img", attrs],
    toText: ({ attrs }) =>
      `![${attrs.alt}](${attrs.src}${attrs.title ? ` "${attrs.title}"` : ""})`,
  },
};

export default function Image() {
  useExtension(extension, "image");
  return null;
}
