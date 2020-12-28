import { keydownHandler } from "prosemirror-keymap";
import { NodeType } from "prosemirror-model";
import {
  liftListItem,
  sinkListItem,
  splitListItem,
} from "prosemirror-schema-list";

import { ExtensionPlugin } from "../../../editor";

class ListPlugin extends ExtensionPlugin {
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

export default function plugins(type: NodeType) {
  return [new ListPlugin(type)];
}
