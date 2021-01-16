import { toDataAttrs, NodeExtension, useExtension } from "../../../editor";

import handle from "./handle";
import plugins from "./plugins";

import "./style.scss";

const extension: NodeExtension = {
  plugins,
  rule: { handle },
  node: {
    attrs: { info: { default: "" } },
    content: "text*",
    marks: "", // disallow marks
    group: "block",
    code: true,
    defining: true,
    draggable: false,
    parseDOM: [
      {
        tag: "pre",
        preserveWhitespace: "full",
        contentElement: "code",
        getAttrs: (node) => (node as HTMLElement).dataset,
      },
    ],
    toDOM: ({ attrs }) => ["pre", toDataAttrs(attrs), ["code", 0]],
  },
};

export default function Code() {
  useExtension(extension, "code");
  return null;
}
