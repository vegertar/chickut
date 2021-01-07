import React from "react";

import { NodeExtension, useExtension } from "../../../editor";

import handle from "./handle";

// use custom tag to take up a specific precedence defined in Manager
const tag = "reference";

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
    parseDOM: [{ tag }],
    toDOM: ({ attrs }) => [tag, attrs],
    toText: ({ attrs }) => `[${attrs.label}]: ${attrs.href} ${attrs.title}`,
  },
};

export default function Reference() {
  useExtension(extension, tag);
  return (
    <span>
      TODO: Reference Content Editing, which might be a global navigation
      similar view{" "}
    </span>
  );
}
