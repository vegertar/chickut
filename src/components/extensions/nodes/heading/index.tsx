import React, { createElement } from "react";
import range from "lodash.range";

import { Extension, NodeExtension, useTextExtension } from "../../../editor";
import handle from "./handle";

import "./style.scss";

const levels = range(1, 7);
const renderers = levels.map(
  (level) => ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement>) =>
    createElement(`h${level}`, props, children)
);

const extension: NodeExtension = {
  rule: {
    handle,
    alt: ["paragraph", "reference", "blockquote"],
  },

  node: {
    attrs: {
      level: {
        default: 1,
      },
    },
    content: "inline*",
    group: "block",
    defining: true,
    draggable: false,
    parseDOM: levels.map((level) => ({
      tag: `h${level}`,
      attrs: { level },
    })),
    toDOM: (node) => [`h${node.attrs.level}`, 0],
    toText: (node) => `${"#".repeat(node.attrs.level)} ${node.textContent}`,
  },
};

function H({
  level,
  children,
  ...props
}: { level: number } & React.HTMLAttributes<HTMLHeadingElement>) {
  const FC = renderers[level - 1];
  return <FC {...props}>{children}</FC>;
}

export default function Heading(props?: { text?: string }) {
  const contentView = useTextExtension(extension, props?.text);
  if (!contentView) {
    return null;
  }

  const { node, content, dom } = contentView;

  return (
    <Extension dom={dom}>
      <H level={node?.attrs?.level || 1}>{content}</H>
    </Extension>
  );
}
