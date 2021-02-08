import { ExtensionPack, toDataAttrs, useExtension } from "../../../editor";

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
    name: "blank",
    node: {
      content: "text*",
      group: "block",
      parseDOM: [{ tag: "div.blank" }],
      toDOM: () => ["div", { class: "blank" }, 0],
    },
  },

  // {
  //   name: "indent",
  //   mark: {
  //     attrs: { size: {} },
  //     inclusive: false,
  //   },
  // },

  {
    name: "markup",
    mark: {
      attrs: { block: { default: false } },
      inclusive: false,
      rank: Infinity,
      parseDOM: [
        {
          tag: "span.markup",
          getAttrs: (node) => (node as HTMLElement).dataset,
        },
      ],
      toDOM: ({ attrs }) => [
        "span",
        { class: "markup", ...toDataAttrs(attrs) },
      ],
    },
  },

  {
    name: "blockmarkup",
    node: {
      content: "text*",
      group: "block",
      parseDOM: [{ tag: "div.markup" }],
      toDOM: () => ["div", { class: "markup" }, 0],
    },
  },

  {
    name: "paragraph",
    node: {
      attrs: { tight: { default: false } },
      content: "inline*",
      group: "block",
      parseDOM: [
        { tag: "p", getAttrs: (node) => (node as HTMLElement).dataset },
      ],
      toDOM: ({ attrs }) => ["p", toDataAttrs(attrs), 0],
    },
    rule: { handle: paragraph },
    plugins: paragraphPlugins,
  },
];

export default function Base() {
  useExtension(pack, "base");
  return null;
}
