import React from "react";
import { NodeSpec } from "prosemirror-model";

import { Node } from "../extension";

export const specs = {
  doc: {
    content: "block+",
  } as NodeSpec,
};

// class DocNode extends Node {}

type Specs = typeof specs;

declare module "../extension" {
  interface NodeSpecs extends Specs {}
}

export default function Doc() {
  return null;
}
