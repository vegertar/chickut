import { ExtensionPack } from "../../../editor";

import item from "./item";

const bulleted: ExtensionPack[0] = {
  name: "bulletedlist",

  node: {
    content: `${item.name}+`,
    group: "block",
    parseDOM: [{ tag: "ul" }],
    toDOM: () => ["ul", 0],
  },
};

export default bulleted;
