import React, { createElement } from "react";
import range from "lodash.range";

import {
  Extension,
  BlockRule,
  NodeSpec,
  useTextExtension,
} from "../../../editor";

import "./style.scss";

const levels = range(1, 7);
const renderers = levels.map(
  (level) => ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement>) =>
    createElement(`h${level}`, props, children)
);

function H({
  level,
  children,
  ...props
}: { level: number } & React.HTMLAttributes<HTMLHeadingElement>) {
  const FC = renderers[level - 1];
  return <FC {...props}>{children}</FC>;
}

export default function Heading(props?: { text?: string }) {
  const contentView = useTextExtension(Heading, props?.text);
  if (!contentView) {
    return null;
  }

  const { node, content, dom, id } = contentView;
  console.log(">>>>>>>>>", id, node.textContent);

  return (
    <Extension dom={dom}>
      <H level={node?.attrs?.level || 1}>{content}</H>
    </Extension>
  );
}

Heading.node = {
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
} as NodeSpec;

Heading.rule = {
  match: /^ {0,3}(?<markup>#{1,6}) +(?<content>.*)/,
  attrs: (matched) => ({ level: matched.groups?.markup.length }),
} as BlockRule;
