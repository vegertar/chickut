import { keymap } from "prosemirror-keymap";
import { NodeSpec, NodeType } from "prosemirror-model";
import {
  splitListItem,
  sinkListItem,
  liftListItem,
} from "prosemirror-schema-list";

import { useExtension } from "../../../editor";

import "./style.scss";

export default function ListItem() {
  useExtension(ListItem);
  return null;
}

ListItem.node = {
  content: "paragraph block*",
  defining: true,
  draggable: true,
  parseDOM: [{ tag: "li" }],
  toDOM: () => ["li", 0],
} as NodeSpec;

ListItem.plugins = (type: NodeType) => [
  keymap({
    Enter: splitListItem(type),
    Tab: sinkListItem(type),
    "Shift-Tab": liftListItem(type),
  }),
];
