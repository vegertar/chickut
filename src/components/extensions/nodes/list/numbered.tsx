import { ExtensionPack } from "../../../editor";

import item from "./item";

const numbered: ExtensionPack[0] = {
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
        : ["ol", { start: node.attrs.order }, 0],
  },
};

export default numbered;
