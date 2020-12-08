import React, { createElement } from "react";
import { Node as ProsemirrorNode, DOMOutputSpec } from "prosemirror-model";
import range from "lodash.range";

import { Extension, useExtension, useTextContent } from "../../../editor";

import "./style.scss";

type Props = {
  text?: string;
};

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

export default function Heading({ text }: Props = {}) {
  const { extensionView } = useExtension(Heading);
  const content = useTextContent(text);
  const level = extensionView?.node.attrs.level || 1;

  return (
    <Extension>
      <H level={level}>{content}</H>
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
  toDOM: (node: ProsemirrorNode): DOMOutputSpec => [`h${node.attrs.level}`, 0],
};

Heading.rule = {
  match: /^ {0,3}(?<markup>#{1,6}) +(?<content>[^\n]*?)(?: +#+)? *(?:\n+|$)/,
  attrs: (matched: string[]) => ({ level: matched[1].length }),
};
