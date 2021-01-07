import { keydownHandler } from "prosemirror-keymap";
import { NodeType } from "prosemirror-model";
import {
  liftListItem,
  sinkListItem,
  splitListItem,
} from "prosemirror-schema-list";

import { BlockRule, ExtensionPlugin, ExtensionSchema } from "../../../editor";

import handle from "./handle";
export class ListItemPlugin extends ExtensionPlugin {
  constructor(type: NodeType) {
    super(type, {
      handleKeyDown: keydownHandler({
        Enter: splitListItem(type),
        Tab: sinkListItem(type),
        "Shift-Tab": liftListItem(type),
      }),
    });
  }
}

const rule: BlockRule = {
  name: "list",
  alt: ["paragraph", "reference", "blockquote"],
  handle,
};

export default function plugins(type: NodeType<ExtensionSchema>) {
  const engine = type.schema.cached.engine;
  if (engine.block.ruler.find(rule.name) === -1) {
    engine.block.ruler.add(rule);
  }
  return [];
}
