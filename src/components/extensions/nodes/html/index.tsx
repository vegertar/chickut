import React from "react";

import { useTextExtension, NodeExtension, Extension } from "../../../editor";

import handle from "./handle";

const extension: NodeExtension = {
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
        preserveWhitespace: "full",
      },
    ],
    toDOM: (node) => ["div", 0],
  },
};

export default function Html(props?: { text?: string }) {
  const { extensionView } = useTextExtension(extension, props?.text);
  if (!extensionView) {
    return null;
  }

  return (
    <>
      {extensionView.map(({ id, dom, node, content }) => (
        <Extension dom={dom} key={id}>
          <div dangerouslySetInnerHTML={{ __html: node.textContent }} />
          {content}
        </Extension>
      ))}
    </>
  );
}
