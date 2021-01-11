import { MarkExtension, useExtension } from "../../../editor";

import handle from "./handle";

const extension: MarkExtension = {
  rule: { handle },
  mark: {
    attrs: { markup: {} },
    parseDOM: [
      { tag: "sub", getAttrs: () => ({ markup: "~" }) },
      { tag: "sup", getAttrs: () => ({ markup: "^" }) },
    ],
    toDOM: ({ attrs }) =>
      attrs.markup === "~" ? ["sub"] : attrs.markup === "^" ? ["sup"] : [""],
    toText: ({ attrs }, s) => `${attrs.markup}${s}${attrs.markup}`,
  },
};

export default function SubSup() {
  useExtension(extension, "subsup");
  return null;
}
