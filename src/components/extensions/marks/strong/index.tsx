import { MarkSpec } from "prosemirror-model";

import { useExtension } from "../../../editor";

import "./style.scss";

export default function Strong() {
  useExtension(Strong);

  return null;
}

Strong.mark = {
  parseDOM: [
    { tag: "b" },
    { tag: "strong" },
    {
      style: "font-style",
      getAttrs: (value) => ((value as string) === "bold" ? {} : false),
    },
  ],
  toDOM: () => ["strong"],
} as MarkSpec;
