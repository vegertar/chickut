import React, { useEffect } from "react";

import { toggleMark } from "prosemirror-commands";
import { MarkSpec } from "prosemirror-model";

import {
  Schema,
  Mark,
  MarkOptions,
  ExtensionProps,
  useMarks,
} from "../extension";

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

// class StrongMark extends Mark {
//   parsedMarkdown = { mark: "strong" };

//   inputRules({ type }: MarkOptions) {
//     return [this.markInputRule(/(?:\*\*)([^*]+)(?:\*\*)$/, type)];
//   }

//   keys({ type }: MarkOptions) {
//     return {
//       "Mod-b": toggleMark(type),
//       "Mod-B": toggleMark(type),
//     };
//   }

//   get toMarkdown() {
//     return {
//       open: "**",
//       close: "**",
//       mixable: true,
//       expelEnclosingWhitespace: true,
//     };
//   }
// }

type Specs = typeof specs;

declare module "../extension" {
  interface MarkSpecs extends Specs {}
}

export default function Strong(props: ExtensionProps) {
  useMarks(specs, props);

  return null;
}
