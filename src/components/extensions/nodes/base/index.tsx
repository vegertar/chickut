import { ExtensionPack, NodeExtension, useExtension } from "../../../editor";

import { paragraph } from "./rules";
import plugins, { ParagraphPlugin } from "./plugins";

import "./style.scss";

const pack: ExtensionPack<NodeExtension> = [
  {
    name: "doc",
    node: { content: "block+" },
    plugins,
  },

  {
    name: "text",
    node: { group: "inline" },
  },

  {
    name: "paragraph",
    node: {
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM: () => ["p", 0],
    },
    rule: { handle: paragraph },
    plugins: (type) => [new ParagraphPlugin(type)],
  },
];

export default function Base() {
  useExtension(pack, "base");
  return null;
}
