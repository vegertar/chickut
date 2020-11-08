import React from "react";
import { MarkdownSerializerState } from "prosemirror-markdown";
import { Node as ProsemirrorNode, NodeSpec } from "prosemirror-model";

import { Node } from "../extension";

export const specs = {
  text: {
    group: "inline",
  } as NodeSpec,
};

// class TextNode extends Node {
//   toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
//     node.text && state.text(node.text);
//   }
// }

type Specs = typeof specs;

declare module "../extension" {
  interface NodeSpecs extends Specs {}
}

export default function Text() {
  return null;
}
