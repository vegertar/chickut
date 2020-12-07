import React, { createElement, useEffect, useState } from "react";
import { Node as ProsemirrorNode, DOMOutputSpec } from "prosemirror-model";
import range from "lodash.range";

import { Extension, useExtension } from "../../../editor";

import "./style.scss";

type Props = {
  text?: string;
};

const levels = range(1, 7);

const renderers = levels.map(
  (level) => () => ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLHeadingElement>) =>
    createElement(`h${level}`, props, children)
);

const parseDOM = levels.map((level) => ({
  tag: `h${level}`,
  attrs: { level },
}));

const toDOM = (node: ProsemirrorNode): DOMOutputSpec => [
  `h${node.attrs.level}`,
  0,
];

export default function Heading({ text }: Props = {}) {
  const { extensionView } = useExtension(Heading);
  const [Renderer, setRenderer] = useState(renderers[0]);

  useEffect(() => {
    const level = extensionView?.node.attrs.level || 1;
    setRenderer(renderers[level - 1]);
  }, [extensionView]);

  return (
    <Extension>
      <Renderer>{extensionView?.content}</Renderer>
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
  parseDOM,
  toDOM,
};

Heading.rule = {
  match: /^ {0,3}(?<markup>#{1,6}) +(?<content>[^\n]*?)(?: +#+)? *(?:\n+|$)/,
  attrs: (matched: string[]) => ({ level: matched[1].length }),
};
