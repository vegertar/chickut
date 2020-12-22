import { baseKeymap } from "prosemirror-commands";
import { keydownHandler } from "prosemirror-keymap";
import { Plugin, PluginKey } from "prosemirror-state";

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
    plugins: [
      new Plugin({
        key: new PluginKey("base"),
        props: {
          handleKeyDown: keydownHandler(baseKeymap),
        },
      }),
    ],
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
