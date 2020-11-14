import { NodeSpec } from "prosemirror-model";

import { useExtension } from "../../extension";

declare module "../../extension" {
  interface NodeExtensions {
    doc: typeof Doc;
  }
}

export default function Doc() {
  useExtension(Doc);

  return null;
}

Doc.node = {
  content: "block+",
} as NodeSpec;
