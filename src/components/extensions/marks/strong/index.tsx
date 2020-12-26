import { MarkExtension, useExtension } from "../../../editor";

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

export default function Strong() {
  useExtension(extension);
  return null;
}
