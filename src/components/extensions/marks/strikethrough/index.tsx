import { MarkExtension, useExtension } from "../../../editor";

import { handle, postHandle } from "./handle";

const extension: MarkExtension = {
  rule: { handle, postHandle },
  mark: {
    parseDOM: [{ tag: "s" }],
    toDOM: () => ["s", 0],
  },
};

export default function Strikethrough() {
  useExtension(extension, "strikethrough");
  return null;
}
