import { baseKeymap } from "prosemirror-commands";
import { keydownHandler } from "prosemirror-keymap";
import { Plugin, PluginKey } from "prosemirror-state";

import { ExtensionPack, useTextExtension } from "../../../editor";

export default function Base(props?: { text?: string }) {
  useTextExtension(Base.pack, props?.text);
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
    name: "br",
    node: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br", priority: -1 }],
      toDOM: () => ["br"],
    },
  },

  {
    name: "default-block",
    node: {
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "default-block" }],
      toDOM: () => ["default-block", 0],
    },
  },
] as ExtensionPack;
