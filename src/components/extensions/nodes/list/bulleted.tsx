import { ExtensionPack, NodeExtension } from "../../../editor";

import item from "./item";
import plugins from "./plugins";

const bulleted: ExtensionPack<NodeExtension>[0] = {
  name: "bulletedlist",
  node: {
    content: `${item.name}+`,
    group: "block",
    parseDOM: [{ tag: "ul" }],
    toDOM: () => ["ul", 0],
  },
  plugins,
};

export default bulleted;
