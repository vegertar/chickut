import { ExtensionPack, useExtension } from "../../../editor";

import { paragraph } from "./rules";
import { docPlugins, paragraphPlugins } from "./plugins";

import "./style.scss";

const pack: ExtensionPack = [
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
    name: "markup",
    mark: {
      inclusive: false,
      rank: Infinity,
      parseDOM: [{ tag: "markup" }],
      toDOM: () => ["markup"],
    },
  },

  {
    name: "paragraph",
    node: {
      attrs: { marker: { default: false } },
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM: ({ attrs }) => ["p", attrs.marker ? { class: "marker" } : {}, 0],
    },
    rule: { handle: paragraph },
    plugins: paragraphPlugins,
  },
];

export default function Base() {
  useExtension(pack, "base");
  return null;
}
