import { NodeSpec } from "prosemirror-model";

import { BlockRule, useExtension } from "../../../editor";
import plugins from "./plugins";

import "./style.scss";

const extension = {
  plugins,
  node: {
    content: "inline*",
    group: "block",
    parseDOM: [{ tag: "p" }],
    toDOM: () => ["p", 0],
  } as NodeSpec,
  rule: {
    match: /(?<content>.*)/,
  } as BlockRule,
};

export default function Paragraph() {
  useExtension(extension);
  return null;
}
