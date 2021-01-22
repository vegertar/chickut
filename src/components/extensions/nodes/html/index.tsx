import React from "react";
import { Portal } from "react-portal";
import { Fragment } from "prosemirror-model";

import { useExtension, NodeExtension } from "../../../editor";

import handle from "./handle";
import plugins from "./plugins";
import { useView, Wrapper } from "./view";

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
        tag: "div.html",
        preserveWhitespace: "full",
        getAttrs: (node) => {
          if (!(node as HTMLElement).querySelector(">.wrapper")) {
            return false;
          }
        },
        getContent: (dom, schema) => {
          const content = (dom.firstChild as HTMLElement).innerHTML;
          return Fragment.from<any>(schema.text(content));
        },
      },
    ],
    toDOM: (node) => {
      const wrapper = document.createElement("div");
      wrapper.className = "wrapper";
      wrapper.innerHTML = node.textContent;
      return ["div", { class: "html" }, wrapper];
    },
  },
};

export default function Html() {
  const { name } = useExtension(extension, "html");
  const { nodeViews } = useView(name);

  return (
    <>
      {nodeViews.map((nodeView) => {
        const { id, dom, cm } = nodeView;
        const html = cm.state.doc.toString();

        return (
          <Portal key={id} node={dom}>
            <Wrapper html={html} />
          </Portal>
        );
      })}
    </>
  );
}
