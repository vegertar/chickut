import { ExtensionPack, NodeExtension } from "../../../editor";

import item from "./item";
import plugins from "./plugins";

const numbered: ExtensionPack<NodeExtension>[0] = {
  name: "numberedlist",
  node: {
    attrs: {
      start: {
        default: 1,
      },
    },
    content: `${item.name}+`,
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
};

export default numbered;
