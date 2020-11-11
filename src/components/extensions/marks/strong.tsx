import { MarkSpec } from "prosemirror-model";

import { useExtension } from "../extension";

declare module "../extension" {
  interface MarkExtensions {
    strong: typeof Strong;
  }
}

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
