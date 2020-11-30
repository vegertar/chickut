import { useEffect } from "react";
import { NodeSpec, NodeType } from "prosemirror-model";
import { textblockTypeInputRule } from "prosemirror-inputrules";
import { inputRules } from "prosemirror-inputrules";
import range from "lodash.range";

import { useExtension } from "../../../editor";

import "./style.scss";

type Props = {
  text?: string;
};

export default function Heading({ text }: Props = {}) {
  const { dispatch } = useExtension(Heading);
  // const type = editorView?.state.schema.nodes[extensionName!];
  // console.log(">>>>", type?.create());

  useEffect(() => {
    console.log(">>>", text);
  }, [dispatch, text]);

  return null;
}

const levels = range(1, 7);

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
} as NodeSpec;

Heading.plugins = (type: NodeType) => [
  inputRules({
    rules: levels.map((level) =>
      textblockTypeInputRule(new RegExp(`^(#{1,${level}})\\s$`), type, () => ({
        level,
      }))
    ),
  }),
];
