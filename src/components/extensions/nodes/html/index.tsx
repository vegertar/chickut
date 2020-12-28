import { useExtension, NodeExtension } from "../../../editor";

import handle from "./handle";
import plugins, { useTemplate } from "./plugins";

const extension: NodeExtension = {
  plugins,

  rule: {
    handle,
    alt: ["paragraph", "reference", "blockquote"],
  },

  node: {
    content: "text*",
    marks: "",
    group: "block",
    code: true,
    defining: true,
    draggable: false,
    parseDOM: [
      {
        tag: "div",
        contentElement: "code",
        preserveWhitespace: "full",
      },
    ],
  },
};

export default function Html() {
  return useTemplate(useExtension(extension));
}
