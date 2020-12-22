import { keydownHandler } from "prosemirror-keymap";
import { NodeType } from "prosemirror-model";
import {
  liftListItem,
  sinkListItem,
  splitListItem,
} from "prosemirror-schema-list";
import { Plugin, PluginKey } from "prosemirror-state";

class ListPlugin extends Plugin {
  constructor(public readonly type: NodeType) {
    super({
      key: new PluginKey(type.name),
      props: {
        handleKeyDown: function (view, event) {
          const self = this as ListPlugin;
          return self.keydownHandler(view, event);
        },
      },
    });
  }

  private keys = {
    Enter: splitListItem(this.type),
    Tab: sinkListItem(this.type),
    "Shift-Tab": liftListItem(this.type),
  };

  private keydownHandler = keydownHandler(this.keys);
}

export default function plugins(type: NodeType) {
  return [new ListPlugin(type)];
}
