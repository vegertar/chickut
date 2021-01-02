import { ExtensionPack, NodeExtension, useExtension } from "../../../editor";

import { paragraphHandle, textPostHandle } from "./rules";
import { BasePlugin, ParagraphPlugin } from "./plugins";

import "./style.scss";

export default function Base() {
  useExtension(Base.pack, "base");
  return null;
}

Base.pack = [
  {
    name: "doc",
    node: {
      content: "block+",
    },
    plugins: (type) => [new BasePlugin(type.name)],
  },

  {
    name: "text",
    node: {
      group: "inline",
    },
    rule: {
      // Since text node are placed between all non-leaf nodes and all marks, by DAG topo,
      // so this rule are properly placed behind all inline rules, as 'text_collapse' did in Markdown-it
      postHandle: textPostHandle,
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
    name: "paragraph",
    node: {
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM: () => ["p", 0],
    },
    rule: {
      handle: paragraphHandle,
    },
    plugins: (type) => [new ParagraphPlugin(type)],
  },
] as ExtensionPack<NodeExtension>;
