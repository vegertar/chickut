import { ExtensionPack, NodeExtension, useExtension } from "../../../editor";

import { paragraph } from "./rules";
import { docPlugins, paragraphPlugins } from "./plugins";

import "./style.scss";

const pack: ExtensionPack<NodeExtension> = [
  {
    name: "doc",
    node: { content: "block+" },
    plugins: docPlugins,
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
    plugins: paragraphPlugins,
  },
];

export default function Base() {
  useExtension(pack, "base");
  return null;
}
