import { ExtensionPack, NodeExtension } from "../../../editor";

import { ListItemPlugin } from "./plugins";

const item: ExtensionPack<NodeExtension>[0] = {
  name: "listitem",
  node: {
    content: "paragraph block*",
    defining: true,
    draggable: true,
    parseDOM: [{ tag: "li" }],
    toDOM: () => ["li", 0],
  },
  plugins: (type) => [new ListItemPlugin(type)],
};

export default item;
