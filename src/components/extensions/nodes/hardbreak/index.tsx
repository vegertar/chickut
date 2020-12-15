import { DOMOutputSpec } from "prosemirror-model";

import { useExtension } from "../../../editor";

export default function Hardbreak() {
  useExtension(Hardbreak);

  return null;
}

Hardbreak.node = {
  inline: true,
  group: "inline",
  selectable: false,
  parseDOM: [{ tag: "br" }],
  toDOM: (): DOMOutputSpec => ["br"],
};
