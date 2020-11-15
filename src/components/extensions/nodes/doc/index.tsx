import { NodeSpec } from "prosemirror-model";

import { useExtension } from "../../../editor";

export default function Doc() {
  useExtension(Doc);

  return null;
}

Doc.node = {
  content: "block+",
} as NodeSpec;
