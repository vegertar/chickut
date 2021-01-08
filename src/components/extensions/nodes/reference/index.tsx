import React from "react";

import { NodeExtension, useExtension } from "../../../editor";

import handle from "./handle";

const name = "reference";
const extension: NodeExtension = {
  rule: {
    handle,
  },

  node: {
    attrs: {
      label: { default: "" },
      title: { default: "" },
      href: { default: "" },
    },
    group: "block",
    parseDOM: [{ tag: `div.${name}` }],
    toDOM: ({ attrs }) => ["div", { ...attrs, class: name }],
    toText: ({ attrs }) => `[${attrs.label}]: ${attrs.href} ${attrs.title}`,
  },
};

export default function Reference() {
  useExtension(extension, name);
  return (
    <span>
      TODO: Reference Content Editing, which might be a global navigation
      similar view{" "}
    </span>
  );
}
