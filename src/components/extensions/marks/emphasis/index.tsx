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
    excludes: "",
    inclusive: false,
    parseDOM: [
      { tag: "em" },
      {
        tag: "strong",
        getAttrs: () => ({ isStrong: true }),
      },
    ],
    toDOM: ({ attrs: { isStrong } }) => [isStrong ? "strong" : "em"],
  },
};

export default function Emphasis() {
  useExtension(extension, "emphasis");
  return null;
}
