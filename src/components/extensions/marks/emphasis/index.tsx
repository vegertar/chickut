import { MarkExtension, toDataAttrs, useExtension } from "../../../editor";

import { handle, postHandle } from "./handle";

import "./style.scss";

const extension: MarkExtension = {
  rule: {
    handle,
    postHandle,
  },

  mark: {
    attrs: { markup: {}, isStrong: { default: false } },
    excludes: "", // allow multiple emphasis marks coexist
    parseDOM: [
      { tag: "em", getAttrs: (node) => (node as HTMLElement).dataset },
      {
        tag: "strong",
        getAttrs: (node) => ({
          ...(node as HTMLElement).dataset,
          isStrong: true,
        }),
      },
    ],
    toDOM: ({ attrs: { isStrong, ...dataset } }) => [
      isStrong ? "strong" : "em",
      toDataAttrs(dataset),
    ],
    toText: ({ attrs }, s) => `${attrs.markup}${s}${attrs.markup}`,
  },
};

export default function Emphasis() {
  useExtension(extension, "emphasis");
  return null;
}
