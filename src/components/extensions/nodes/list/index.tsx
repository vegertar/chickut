import {
  useExtension,
  ExtensionPack,
  getAttrs,
  NonRuleNodeExtension,
} from "../../../editor";

import names from "./names";
import plugins, { ListItemPlugin } from "./plugins";

import "./style.scss";

const pack: ExtensionPack<NonRuleNodeExtension> = [
  {
    name: names.bulleted,
    node: {
      attrs: { marker: { default: "-" } },
      content: `${names.item}+`,
      group: "block",
      parseDOM: [{ tag: "ul" }], // TODO: parse marker attributes
      toDOM: () => ["ul", 0],
    },
    plugins,
  },

  {
    name: names.ordered,
    node: {
      attrs: { start: { default: 1 } },
      content: `${names.item}+`,
      group: "block",
      parseDOM: [{ tag: "ol", getAttrs: (node) => getAttrs(node as Element) }],
      toDOM: ({ attrs }) => (attrs.start === 1 ? ["ol", 0] : ["ol", attrs, 0]),
    },
    plugins,
  },

  {
    name: names.item,
    node: {
      attrs: { indent: { default: 0 }, blockIndent: { default: 2 } },
      content: "block+",
      defining: true,
      draggable: true,
      parseDOM: [{ tag: "li" }], // TODO: parse indent attributes
      toDOM: () => ["li", 0],
    },
    plugins: (type) => [new ListItemPlugin(type)],
  },
];

export default function List() {
  useExtension(pack, names.list);
  return null;
}
