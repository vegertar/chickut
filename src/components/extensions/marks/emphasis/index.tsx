import { MarkExtension, useExtension } from "../../../editor";

import { handle, postHandle } from "./handle";

import "./style.scss";

const extension: MarkExtension = {
  rule: {
    handle,
    postHandle,
  },

  mark: {
    attrs: { isStrong: { default: false } },
    excludes: "", // allow multiple emphasis marks coexist
    parseDOM: [
      { tag: "em" },
      { tag: "strong", getAttrs: () => ({ isStrong: true }) },
    ],
    toDOM: ({ attrs }) => [attrs.isStrong ? "strong" : "em"],
    toText: ({ attrs }, s) => (attrs.isStrong ? `**${s}**` : `*${s}*`),
  },
};

export default function Emphasis() {
  useExtension(extension, "emphasis");
  return null;
}
