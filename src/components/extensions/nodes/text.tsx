import { TokenConfig } from "prosemirror-markdown";
import { NodeSpec } from "prosemirror-model";

import { useExtension } from "../extension";

type Specs = typeof specs;
type Tokens = Partial<{ [name in keyof Specs]: TokenConfig }>;

declare module "../extension" {
  interface NodeSpecs extends Specs {}
}

export const specs = {
  text: {
    group: "inline",
  } as NodeSpec,
};

export const tokens: Tokens = {};

export default function Text() {
  useExtension(specs, null, tokens);

  return null;
}
