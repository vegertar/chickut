import { NodeSpec } from "prosemirror-model";

import { useTextExtension, BlockRule } from "../../../editor";

import "./style.scss";

export default function BulletedList(props?: { text?: string }) {
  useTextExtension(BulletedList, props?.text);

  return null;
}

BulletedList.node = {
  content: "listitem+",
  group: "block",
  parseDOM: [{ tag: "ul" }],
  toDOM: () => ["ul", 0],
} as NodeSpec;

BulletedList.rule = {
  match: /^ {0,3}(?:[-+*])\s+(?<content>.*)/,
  contentTag: "listitem",
} as BlockRule;
