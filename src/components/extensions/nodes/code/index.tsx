import { NodeExtension, useExtension } from "../../../editor";
import handle from "./handle";
import plugins from "./plugins";

import "./style.scss";

const extension: NodeExtension = {
  plugins,

  rule: {
    handle,
  },

  node: {
    attrs: {
      info: { default: "" },
    },
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
      },
    ],
    toDOM: (node) => [
      "pre",
      // TODO: handle fence info
      { "data-info": node.attrs.info, class: node.type.name },
      ["code", 0],
    ],
  },
};

export default function Code() {
  useExtension(extension, "code");
  return null;
}
