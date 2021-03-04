import { keydownHandler } from "prosemirror-keymap";
import {
  NodeType,
  ResolvedPos,
  Node as ProsemirrorNode,
} from "prosemirror-model";
import {
  liftListItem,
  sinkListItem,
  splitListItem,
} from "prosemirror-schema-list";
import { EditorState, Plugin, PluginKey, Transaction } from "prosemirror-state";

import { BlockRule, ExtensionSchema } from "../../../editor";
import { parseContent, textBetween } from "../base/utils";

import handle from "./handle";
import names from "./names";

type JoinProps = {
  $container: ResolvedPos;
  $prev: ResolvedPos;
  $block: ResolvedPos;
};

type ListIndent = {
  indent: number;
  blockIndent: number;
};

function isList({ type }: ProsemirrorNode) {
  return type.name !== names.bulleted || type.name !== names.ordered;
}

function getListIndent(list: ProsemirrorNode) {
  if (!isList(list)) {
    throw new Error(`Invalid list type: ${list.type.name}`);
  }

  return list.child(0).attrs as ListIndent;
}

function join(state: EditorState, { $container, $prev, $block }: JoinProps) {
  if ($prev.parent.type.name !== names.item) {
    return null;
  }

  const tr = state.tr;
  const container = $container.parent;
  const prev = $prev.parent;
  const block = $block.parent;
  const before = prev.childBefore($block.before() - $prev.start());

  let i = $prev.start();
  if (!before.node) {
    tr.delete($block.before(), $block.after());
    block.forEach((child) => {
      tr.insert(i, child.content);
      i += child.content.size;
    });
  } else {
    const prevIndent = prev.attrs as ListIndent;
    const currIndent = getListIndent(block);
    if (
      currIndent.indent > prevIndent.indent &&
      currIndent.indent < prevIndent.blockIndent
    ) {
      // lift the list item level
      tr.delete($block.before(), $block.after());
      i += before.node.nodeSize + before.offset;
      block.forEach((child) => {
        tr.insert(i, child);
        i += child.nodeSize;
      });
    } else if (isList(container)) {
      // there might be a mistaken continuously paragraph
      const node = container.cut(0, $block.after());
      const content = parseContent(node);
      if (content) {
        const newNode = content[0];
        console.log(node.toString(), "\n", newNode.toString());
      }
    }
  }

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
          const tr = props && join(state, props);
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
