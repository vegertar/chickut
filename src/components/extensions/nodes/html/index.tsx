import React from "react";

import { useExtension, NodeExtension } from "../../../editor";

import handle from "./handle";
import plugins from "./plugins";
import { useView } from "./view";

const name = "html";
const extension: NodeExtension = {
  plugins,

  rule: {
    handle,
    alt: ["paragraph", "reference", "blockquote"],
  },

  node: {
    content: "text*",
    marks: "",
    group: "block", // TODO: html inline
    code: true,
    defining: true,
    draggable: false,
    parseDOM: [
      {
        tag: `div.${name}`,
        contentElement: ">pre>code",
        preserveWhitespace: "full",
      },
    ],
    toDOM: () => [
      "div",
      { class: name },
      ["pre", ["code", { spellCheck: "false" }, 0]],
      ["div", { class: "view", contentEditable: "false" }],
    ],
  },
};

export default function Html() {
  return useView(useExtension(extension, name));
}
