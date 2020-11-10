import { useEffect } from "react";
import { selectAll } from "prosemirror-commands";
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

type Props = {
  children?: string;
};

export default function Text({ children: defaultValue }: Props = {}) {
  const view = useExtension(specs, null, tokens);

  useEffect(() => {
    if (!view || !defaultValue) {
      return;
    }

    selectAll(view.state, (tr) => {
      view.dispatch(tr.insertText(defaultValue));
    });
  }, [view, defaultValue]);

  return null;
}
