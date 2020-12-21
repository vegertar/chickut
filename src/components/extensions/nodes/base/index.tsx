import { baseKeymap } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";

import { ExtensionPack, useExtension } from "../../../editor";

export default function Base() {
  useExtension(Base.pack);
  return null;
}

Base.pack = [
  {
    name: "doc",
    node: {
      content: "block+",
    },
    plugins: [keymap(baseKeymap)],
  },

  {
    name: "text",
    node: {
      group: "inline",
    },
  },

  {
    name: "hardbreak",
    node: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br" }],
      toDOM: () => ["br"],
    },
  },
] as ExtensionPack;
