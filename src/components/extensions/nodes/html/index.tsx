import React from "react";
import { Portal } from "react-portal";

import { useTextExtension, NodeExtension } from "../../../editor";

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
    toDOM: () => ["div", 0],
  },
};

export default function Html(props?: { text?: string }) {
  const { contentView } = useTextExtension(extension, props?.text);
  if (!contentView) {
    return null;
  }

  const { dom, id, content, getPos } = contentView;
  console.log(id, getPos());

  return (
    <Portal node={dom} key={id}>
      <pre>
        <code>{content}</code>
      </pre>
    </Portal>
  );
}
