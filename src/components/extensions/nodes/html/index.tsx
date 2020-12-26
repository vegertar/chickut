import React from "react";
import { Portal } from "react-portal";

import { useExtension, NodeExtension } from "../../../editor";

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

export default function Html() {
  useExtension(extension);
  return null;

  // return (
  //   <>
  //     {view?.map(({ id, dom, content }) => (
  //       <Portal node={dom} key={id}>
  //         <pre>
  //           <code>{content}</code>
  //         </pre>
  //       </Portal>
  //     ))}
  //   </>
  // );
}
