import { DOMOutputSpec } from "prosemirror-model";

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
  toDOM: (): DOMOutputSpec => ["ul", 0],
};

BulletedList.rule = {
  match: /^ {0,3}(?:[-+*])\s+/,
};
