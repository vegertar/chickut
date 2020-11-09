import { TokenConfig } from "prosemirror-markdown";
import { MarkSpec } from "prosemirror-model";

import { useExtension } from "../extension";

type Specs = typeof specs;
type Tokens = Partial<{ [name in keyof Specs]: TokenConfig }>;

declare module "../extension" {
  interface MarkSpecs extends Specs {}
}

export const specs = {
  strong: {
    parseDOM: [
      { tag: "b" },
      { tag: "strong" },
      {
        style: "font-style",
        getAttrs: (value) => ((value as string) === "bold" ? {} : false),
      },
    ],
    toDOM: () => ["strong"],
  } as MarkSpec,
};

export const tokens: Tokens = {
  strong: {
    mark: "strong",
  },
};

export default function Strong() {
  useExtension(null, specs, tokens);

  return null;
}
