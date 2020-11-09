import { TokenConfig } from "prosemirror-markdown";
import { NodeSpec } from "prosemirror-model";

import { useExtension } from "../extension";

type Specs = typeof specs;
type Tokens = Partial<{ [name in keyof Specs]: TokenConfig }>;

declare module "../extension" {
  interface NodeSpecs extends Specs {}
}

export const specs = {
  paragraph: {
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: "p" }],
    toDOM: () => ["p", 0],
  } as NodeSpec,
};

export const tokens: Tokens = {
  paragraph: {
    block: "paragraph",
  },
};

export default function Paragraph() {
  useExtension(specs, null, tokens);

  return null;
}
