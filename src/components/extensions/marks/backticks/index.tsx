import { MarkExtension, useExtension } from "../../../editor";

import handle from "./handle";

import "./styles.scss";

const extension: MarkExtension = {
  rule: { handle },
  mark: {
    excludes: "_", // excludes all marks
    parseDOM: [{ tag: "code" }],
    toDOM: () => ["code", { spellCheck: "false" }],
  },
};

export default function Backticks() {
  useExtension(extension, "backticks");
  return null;
}
