import { baseKeymap } from "prosemirror-commands";
import { keydownHandler } from "prosemirror-keymap";

import { ExtensionPack, Plugin, useExtension } from "../../../editor";

export default function Base() {
  useExtension(Base.pack);
  return null;
}

class BasePlugin extends Plugin {
  constructor() {
    super("base", {
      handleKeyDown: keydownHandler(baseKeymap),
    });
  }
}

Base.pack = [
  {
    name: "doc",
    node: {
      content: "block+",
    },
    plugins: [new BasePlugin()],
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
