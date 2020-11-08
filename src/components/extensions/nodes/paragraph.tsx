import React from "react";
import { setBlockType } from "prosemirror-commands";
import { MarkdownSerializerState } from "prosemirror-markdown";
import { Node as ProsemirrorNode, NodeSpec } from "prosemirror-model";

import { Node, NodeOptions } from "../extension";

export const specs = {
  paragraph: {
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: "p" }],
    toDOM: () => ["p", 0],
  } as NodeSpec,
};

// class ParagraphNode extends Node {
//   keys({ type }: NodeOptions) {
//     return {
//       "Shift-Ctrl-0": setBlockType(type),
//     };
//   }

//   commands({ type }: NodeOptions) {
//     return () => setBlockType(type);
//   }

//   toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
//     // render empty paragraphs as hard breaks to ensure that newlines are
//     // persisted between reloads (this breaks from markdown tradition)
//     // if (
//     //   node.textContent.trim() === "" &&
//     //   node.childCount === 0 &&
//     //   !state.inTable
//     // ) {
//     //   state.write("\\\n");
//     // } else {
//     //   state.renderInline(node);
//     //   state.closeBlock(node);
//     // }
//     return undefined;
//   }

//   parseMarkdown() {
//     return { block: "paragraph" };
//   }
// }

type Specs = typeof specs;

declare module "../extension" {
  interface NodeSpecs extends Specs {}
}

export default function Paragraph() {
  return null;
}
