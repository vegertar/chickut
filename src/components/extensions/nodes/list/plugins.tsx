import { keydownHandler } from "prosemirror-keymap";
import { NodeType } from "prosemirror-model";
import {
  liftListItem,
  sinkListItem,
  splitListItem,
} from "prosemirror-schema-list";
import { Plugin, PluginKey } from "prosemirror-state";

import { BlockRule, ExtensionSchema } from "../../../editor";

import handle from "./handle";
import names from "./names";

export class ListItemPlugin extends Plugin {
  constructor(type: NodeType) {
    super({
      key: new PluginKey(type.name),
      props: {
        // handleKeyDown: keydownHandler({
        //   Enter: splitListItem(type),
        //   Tab: sinkListItem(type),
        //   "Shift-Tab": liftListItem(type),
        // }),
      },
    });
  }
}

const rule: BlockRule = {
  name: names.list,
  alt: ["paragraph", "reference", "blockquote"],
  handle,
};

export default function plugins(type: NodeType<ExtensionSchema>) {
  const engine = type.schema.cached.engine;
  if (engine.block.ruler.find(rule.name) === -1) {
    engine.block.ruler.append(rule);
  }
  return [];
}
