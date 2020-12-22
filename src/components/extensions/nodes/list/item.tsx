import { ExtensionPack } from "../../../editor";

const item: ExtensionPack[0] = {
  name: "listitem",
  node: {
    content: "paragraph block*",
    defining: true,
    draggable: true,
    parseDOM: [{ tag: "li" }],
    toDOM: () => ["li", 0],
  },
};

export default item;
