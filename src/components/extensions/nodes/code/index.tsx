import {
  getDataset,
  toDataAttrs,
  NodeExtension,
  useExtension,
} from "../../../editor";

import handle from "./handle";
import plugins from "./plugins";

import "./style.scss";

const extension: NodeExtension = {
  plugins,
  rule: { handle },
  node: {
    attrs: { info: { default: "" } },
    content: "text*",
    marks: "",
    group: "block",
    code: true,
    defining: true,
    draggable: false,
    parseDOM: [
      {
        tag: "pre",
        preserveWhitespace: "full",
        contentElement: "code",
        getAttrs: (node) => getDataset(node as HTMLElement),
      },
    ],
    toDOM: ({ attrs }) => ["pre", toDataAttrs(attrs), ["code", 0]],
  },
};

export default function Code() {
  useExtension(extension, "code");
  return null;
}
