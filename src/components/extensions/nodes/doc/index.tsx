import { NodeSpec } from "prosemirror-model";

import { useExtension } from "../../extension";

export default function Doc() {
  useExtension(Doc);

  return null;
}

Doc.node = {
  content: "block+",
} as NodeSpec;
