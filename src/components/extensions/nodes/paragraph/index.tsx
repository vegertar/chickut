import { NodeSpec } from "prosemirror-model";

import { useExtension } from "../../extension";

import "./style.scss";

declare module "../../extension" {
  interface NodeExtensions {
    paragraph: typeof Paragraph;
  }
}

export default function Paragraph() {
  useExtension(Paragraph);

  return null;
}

Paragraph.node = {
  content: "inline*",
  group: "block",
  parseDOM: [{ tag: "p" }],
  toDOM: () => ["p", 0],
} as NodeSpec;
