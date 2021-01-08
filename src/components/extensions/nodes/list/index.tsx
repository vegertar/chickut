import { useExtension, ExtensionPack, NodeExtension } from "../../../editor";

import names from "./names";
import plugins, { ListItemPlugin } from "./plugins";

import "./style.scss";

const pack: ExtensionPack<NodeExtension> = [
  {
    name: names.bulleted,
    node: {
      content: `${names.item}+`,
      group: "block",
      parseDOM: [{ tag: "ul" }],
      toDOM: () => ["ul", 0],
    },
    plugins,
  },

  {
    name: names.numbered,
    node: {
      attrs: {
        start: {
          default: 1,
        },
      },
      content: `${names.item}+`,
      group: "block",
      parseDOM: [
        {
          tag: "ol",
          getAttrs: (dom) => ({
            start: parseInt((dom as HTMLElement).getAttribute("start") || "1"),
          }),
        },
      ],
      toDOM: (node) =>
        node.attrs.order === 1
          ? ["ol", 0]
          : ["ol", { start: node.attrs.start }, 0],
    },
    plugins,
  },

  {
    name: names.item,
    node: {
      content: "paragraph block*",
      defining: true,
      draggable: true,
      parseDOM: [{ tag: "li" }],
      toDOM: () => ["li", 0],
    },
    plugins: (type) => [new ListItemPlugin(type)],
  },
];

export default function List() {
  useExtension(pack, names.list);
  return null;
}
