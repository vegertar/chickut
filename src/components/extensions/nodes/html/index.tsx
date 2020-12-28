import { useExtension, NodeExtension } from "../../../editor";

import handle from "./handle";
import plugins from "./plugins";
import { useView } from "./view";

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
        contentElement: ">pre>code",
        preserveWhitespace: "full",
        getAttrs: (node) => {
          if (!(node as HTMLElement).querySelector(">div.view")) {
            return false;
          }
        },
      },
    ],
    toDOM: (node) => [
      "div",
      { class: node.type.name },
      ["pre", ["code", { spellCheck: "false" }, 0]],
      ["div", { class: "view", contentEditable: "false" }],
    ],
  },
};

export default function Html() {
  return useView(useExtension(extension));
}
