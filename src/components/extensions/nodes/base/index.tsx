import { baseKeymap } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";

import { NodeSpec, useExtension } from "../../../editor";

export default function Base() {
  useExtension(Base.pack);
  return null;
}

Base.pack = [
  {
    name: "doc",
    node: {
      content: "block+",
    } as NodeSpec,
    plugins: [keymap(baseKeymap)],
  },

  {
    name: "text",
    node: {
      group: "inline",
    } as NodeSpec,
  },

  {
    name: "hardbreak",
    node: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br" }],
      toDOM: () => ["br"],
    } as NodeSpec,
  },
];
