import { useTextExtension, NodeExtension } from "../../../editor";
import handle from "./handle";
// import plugins from "./plugins";

// import "./style.scss";

const extension: NodeExtension = {
  rule: {
    handle,
    alt: ["paragraph", "reference", "blockquote"],
  },

  // plugins,
  node: {
    attrs: {
      language: {
        default: "html",
      },
    },
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
        getAttrs: (node) => {
          const dom = node as HTMLElement;
          if (dom.dataset.language !== "html") {
            return false;
          }
        },
      },
    ],
    toDOM: (node) => ["div", { "data-language": node.attrs.language }, 0],
  },
};

export default function Html(props?: { text?: string }) {
  useTextExtension(extension, props?.text);
  return null;
}
