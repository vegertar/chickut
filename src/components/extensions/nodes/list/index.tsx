import { keymap } from "prosemirror-keymap";
import { NodeSpec, NodeType } from "prosemirror-model";
import {
  splitListItem,
  sinkListItem,
  liftListItem,
} from "prosemirror-schema-list";

import { useExtension, BlockRule } from "../../../editor";

export default function List() {
  useExtension(List.pack);
  return null;
}

List.pack = [
  {
    name: "listitem",
    node: {
      content: "paragraph block*",
      defining: true,
      draggable: true,
      parseDOM: [{ tag: "li" }],
      toDOM: () => ["li", 0],
    } as NodeSpec,
    plugins: (type: NodeType) => [
      keymap({
        Enter: splitListItem(type),
        Tab: sinkListItem(type),
        "Shift-Tab": liftListItem(type),
      }),
    ],
  },
  {
    name: "bulletedlist",
    node: {
      content: "listitem+",
      group: "block",
      parseDOM: [{ tag: "ul" }],
      toDOM: () => ["ul", 0],
    } as NodeSpec,
    rule: {
      match: /^ {0,3}(?:[-+*])\s+(?<content>.*)/,
      contentTag: "listitem",
    } as BlockRule,
  },
];
