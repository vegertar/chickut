import { NodeSpec } from "prosemirror-model";

import { useExtension } from "../../../editor";

export default function Text() {
  useExtension(Text);

  return null;
}

Text.node = {
  group: "inline",
} as NodeSpec;
