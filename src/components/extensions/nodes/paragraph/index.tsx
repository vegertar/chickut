import { NodeSpec } from "prosemirror-model";

import { useExtension } from "../../extension";

import "./style.scss";

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
