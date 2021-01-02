import { MarkExtension, useExtension } from "../../../editor";

import { handle, postHandle } from "./handle";

import "./style.scss";

const extension: MarkExtension = {
  rule: {
    handle,
    postHandle,
  },

  mark: {
    attrs: {
      isStrong: {
        default: false,
      },
    },

    parseDOM: [{ tag: "em" }, { tag: "strong" }],
    toDOM: (mark) => [mark.attrs.isStrong ? "strong" : "em"],
  },
};

export default function Emphasis() {
  useExtension(extension, "emphasis");
  return null;
}
