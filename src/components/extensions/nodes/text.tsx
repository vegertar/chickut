import { useEffect } from "react";
import { selectAll } from "prosemirror-commands";
import { NodeSpec } from "prosemirror-model";

import { useExtension } from "../extension";

declare module "../extension" {
  interface NodeExtensions {
    text: typeof Text;
  }
}

type Props = {
  children?: string;
};

export default function Text({ children: defaultValue }: Props = {}) {
  const { status, view } = useExtension(Text);

  useEffect(() => {
    if (!status || !view || !defaultValue) {
      return;
    }

    selectAll(view.state, (tr) => {
      view.dispatch(tr.insertText(defaultValue));
    });
  }, [status, view, defaultValue]);

  return null;
}

Text.node = {
  group: "inline",
} as NodeSpec;
