import { keydownHandler } from "prosemirror-keymap";
import { NodeType, ResolvedPos } from "prosemirror-model";
import {
  liftListItem,
  sinkListItem,
  splitListItem,
} from "prosemirror-schema-list";
import { Plugin, PluginKey, Transaction } from "prosemirror-state";

import { BlockRule, ExtensionSchema } from "../../../editor";

import handle from "./handle";
import names from "./names";

type JoinProps = {
  $prev: ResolvedPos;
  $block: ResolvedPos;
};

function join(tr: Transaction, { $prev: $item, $block: $list }: JoinProps) {
  if ($item.parent.type.name !== names.item) {
    return null;
  }

  const item = $item.parent;
  const list = $list.parent;

  tr.delete($list.before(), $list.after());

  let i = $item.start();
  let j = $item.after() - list.nodeSize;

  list.forEach((child) => {
    if (child.sameMarkup(item)) {
      tr.insert(i, child.content);
      i += child.content.size;
      j += child.content.size;
    } else {
      console.log(child.attrs, item.attrs);
      tr.insert(j, child);
      j += child.nodeSize;
    }
  });

  return tr;
}

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
      appendTransaction(trs, _, state) {
        for (let i = trs.length - 1; i >= 0; --i) {
          const props: JoinProps | undefined = trs[i].getMeta("join");
          const tr = props && join(state.tr, props);
          if (tr) {
            return tr;
          }
        }
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
