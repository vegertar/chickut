import { MarkSpec, MarkType } from "prosemirror-model";
import { inputRules } from "prosemirror-inputrules";

import { useExtension } from "../../../editor";
import { markInputRule } from "../utils";

import "./style.scss";

export default function Code() {
  useExtension(Code);

  return null;
}

Code.mark = {
  excludes: "_",
  parseDOM: [{ tag: "code" }],
  toDOM: () => ["code", { spellCheck: "false" }],
} as MarkSpec;

Code.plugins = (type: MarkType) => [
  inputRules({
    rules: [markInputRule(/(?:^|[^`])(`([^`]+)`)$/, type)],
  }),
];
