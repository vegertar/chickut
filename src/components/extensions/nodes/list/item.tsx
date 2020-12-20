import { keymap } from "prosemirror-keymap";
import { NodeSpec, NodeType } from "prosemirror-model";
import {
  splitListItem,
  sinkListItem,
  liftListItem,
} from "prosemirror-schema-list";

const item = {
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
};

export default item;
