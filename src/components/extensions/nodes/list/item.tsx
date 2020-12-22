import { keymap } from "prosemirror-keymap";
import {
  splitListItem,
  sinkListItem,
  liftListItem,
} from "prosemirror-schema-list";

import { ExtensionPack, NodeExtension } from "../../../editor";

const item: ExtensionPack<NodeExtension>[0] = {
  name: "listitem",

  node: {
    content: "paragraph block*",
    defining: true,
    draggable: true,
    parseDOM: [{ tag: "li" }],
    toDOM: () => ["li", 0],
  },

  plugins: (type) => [
    keymap({
      Enter: splitListItem(type),
      Tab: sinkListItem(type),
      "Shift-Tab": liftListItem(type),
    }),
  ],
};

export default item;
