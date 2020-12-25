import { MarkExtension, useTextExtension } from "../../../editor";

import "./style.scss";

const extension: MarkExtension = {
  mark: {
    parseDOM: [
      { tag: "b" },
      { tag: "strong" },
      {
        style: "font-style",
        getAttrs: (value) => (value === "bold" ? null : false),
      },
    ],
    toDOM: () => ["strong"],
  },
};

export default function Strong(props?: { text?: string }) {
  useTextExtension(extension, props?.text);
  return null;
}
