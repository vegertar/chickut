import { inputRules, wrappingInputRule } from "prosemirror-inputrules";
import { NodeSpec, NodeType } from "prosemirror-model";

import { useExtension } from "../../../editor";

import "./style.scss";

export default function BulletedList() {
  useExtension(BulletedList);
  return null;
}

BulletedList.node = {
  content: "listitem+",
  group: "block",
  parseDOM: [{ tag: "ul" }],
  toDOM: () => ["ul", 0],
} as NodeSpec;

BulletedList.plugins = (type: NodeType) => [
  inputRules({
    rules: [wrappingInputRule(/^\s*([-+*])\s$/, type)],
  }),
];
