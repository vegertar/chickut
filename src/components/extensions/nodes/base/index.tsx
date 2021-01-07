import { ExtensionPack, NodeExtension, useExtension } from "../../../editor";

import { paragraphHandle, textPostHandle } from "./rules";
import { BasePlugin, ParagraphPlugin } from "./plugins";

import "./style.scss";

const pack: ExtensionPack<NodeExtension> = [
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
      // so this rule is properly placed after all inline rules, as 'text_collapse' did in Markdown-it
      postHandle: textPostHandle,
    },
  },

  {
    name: "newline",
    node: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br" }],
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
];

export default function Base() {
  useExtension(pack, "base");
  return null;
}
