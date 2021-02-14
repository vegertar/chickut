import {
  Fragment,
  Node as ProsemirrorNode,
  NodeType,
  ResolvedPos,
} from "prosemirror-model";
import { findWrapping, liftTarget } from "prosemirror-transform";
import { Transaction } from "prosemirror-state";
import { ExtensionSchema } from "../../../editor";

export function textsBetween(
  node: ProsemirrorNode | Fragment,
  from: number,
  to: number,
  f: (text: string, pos: number) => boolean | void,
  nodeStart = 0
) {
  for (let i = 0, pos = 0; pos < to; i++) {
    const child = node.child(i);
    const end = pos + child.nodeSize;
    if (end > from) {
      if (child.isBlock) {
        if (child.content.size) {
          const start = pos + 1;
          if (
            textsBetween(
              child,
              Math.max(0, from - start),
              Math.min(child.content.size, to - start),
              f,
              nodeStart + start
            )
          ) {
            return true;
          }
        }

        if (
          child.type.name !== "blockmarkup" &&
          end < to &&
          f("\n", nodeStart + end)
        ) {
          return true;
        }
      } else if (child.isText && child.text && f(child.text, nodeStart + pos)) {
        return true;
      }
    }
    pos = end;
  }
}

export function textBetween(
  node: ProsemirrorNode | Fragment,
  from: number,
  to: number
) {
  let text = "";
  textsBetween(node, from, to, (s, pos) => {
    text += s.slice(Math.max(from, pos) - pos, to - pos);
  });
  return text;
}

export function textIndex(doc: ProsemirrorNode, pos: number) {
  const from = 0;
  const to = doc.content.size;
  let index = 0;

  textsBetween(doc, from, to, (s, i) => {
    if (pos < i) {
      return true;
    }

    const start = Math.max(from, i) - i;
    const end = to - i;
    const n = Math.min(end - start, s.length);
    index += n;
    const delta = i + n - pos;
    if (delta >= 0) {
      index -= delta;
      return true;
    }
  });

  return index;
}

export function docCursor(doc: ProsemirrorNode, index: number) {
  const from = 0;
  const to = doc.content.size;

  let cursor = 0;

  textsBetween(doc, from, to, (s, pos) => {
    const start = Math.max(from, pos) - pos;
    const end = to - pos;
    const n = Math.min(end - start, s.length);
    cursor = pos + n;
    index -= n;
    if (index <= 0) {
      cursor += index;
      return true;
    }
  });

  return cursor;
}

type MARKUP_TYPE = 0 | 1 | 2; // 0: no markup; 1: inline markup; 2: block markup

function checkMarkup(node: ProsemirrorNode): MARKUP_TYPE {
  if (node.type.name === "blockmarkup") {
    return 2;
  }

  if (!node.isText || !node.marks.length) {
    return 0;
  }

  const markup = node.marks.find((mark) => mark.type.name === "markup");
  if (!markup) {
    return 0;
  }
  return markup.attrs.block ? 2 : 1;
}

export function sourceNode(tr: Transaction, pos: number) {
  if (pos < 1) {
    return tr.doc.resolve(1);
  }

  // TODO: optimize: source if and only if markup letters appear between [head, cursor)

  let $node = tr.doc.resolve(pos);
  const markupType = checkMarkup(tr.doc.nodeAt(pos) || $node.parent);
  if (markupType !== 2) {
    return $node;
  }

  while (true) {
    const node = $node.parent;
    if (!node.isBlock) {
      return null;
    }
    if (!node.isTextblock) {
      break;
    }
    $node = tr.doc.resolve($node.before());
  }

  return $node;
}

function isContainer({ type }: ProsemirrorNode) {
  return type.isBlock && !type.isTextblock && !type.isLeaf;
}

function canJoinNextParagraph($curr: ResolvedPos, next: ProsemirrorNode) {
  const a = $curr.parent.lastChild;
  if (!a || a.type.name !== "paragraph" || next.childCount < 2) {
    return false;
  }

  const b = next.child(0);
  const c = next.child(1);
  if (b.type.name !== "blockmarkup" || c.type !== a.type) {
    return false;
  }

  return true;
}

function joinNextParagraph(
  tr: Transaction,
  $curr: ResolvedPos,
  next: ProsemirrorNode
) {
  const { node, offset } = $curr.parent.childBefore($curr.parent.content.size);
  let index = $curr.start() + offset + (node ? node.nodeSize : 0);
  tr.insertText("\n", index - 1);

  for (let i = 0; i < next.childCount; ++i) {
    const node = next.child(i);
    if (i < 2) {
      tr.insert(index, node.content);
      index += node.content.size;
    } else {
      tr.insert(index, node);
      index += node.nodeSize;
    }
  }
}

function joinParagraph(tr: Transaction, $curr: ResolvedPos) {
  if ($curr.parent.type.name !== "paragraph") {
    return;
  }

  const $container = tr.doc.resolve($curr.start(-1));
  const container = $container.parent;
  const next = container.childAfter($curr.after());
  if (!next.node) {
    return;
  }

  let j = next.index;
  let size = 0;
  for (; j < container.childCount; ++j) {
    const child = container.child(j);
    if (child.type.name !== "blockmarkup" && child.type.name !== "paragraph") {
      break;
    }
    size += child.nodeSize;
  }

  if (!size) {
    return;
  }

  const start = $container.start();
  let pos = start + next.offset;
  tr.delete(pos, pos + size);

  pos = $curr.end();
  tr.insertText("\n", pos);
  ++pos;
  for (let i = next.index; i < j; ++i) {
    const child = container.child(i);
    tr.insert(pos, child.content);
    pos += child.content.size;
  }
}

export function joinContainer(tr: Transaction, pos: number) {
  const $curr = tr.doc.resolve(pos);
  if (!isContainer($curr.parent)) {
    joinParagraph(tr, $curr);
    return;
  }

  const start = $curr.start();
  const after = $curr.after();
  const next = tr.doc.nodeAt(after);
  if (next && next.type === $curr.parent.type) {
    tr.deleteRange(after, after + next.content.size);
    if (canJoinNextParagraph($curr, next)) {
      joinNextParagraph(tr, $curr, next);
    } else {
      tr.insert(start + $curr.parent.content.size, next.content);
    }
  }

  const $before = start <= 1 ? null : tr.doc.resolve(start - 2);
  if (!$before || $before.parent.type !== $curr.parent.type) {
    return;
  }

  const node = tr.doc.resolve(start).parent;
  if (canJoinNextParagraph($before, node)) {
    tr.deleteRange(start, start + node.content.size);
    joinNextParagraph(tr, $before, node);
  } else {
    const before = $before.parent;
    tr.deleteRange($before.start(), $before.end()).insert(
      start - before.nodeSize,
      before.content
    );
  }
}

export function setBlockMarkup(type: NodeType, nodes: ProsemirrorNode[]) {
  if (type.isBlock && !type.isTextblock) {
    for (let i = 0; i < nodes.length; ++i) {
      if (nodes[i].type.isText && !type.validContent(Fragment.from(nodes[i]))) {
        const schema = type.schema as ExtensionSchema;
        nodes[i] = schema.nodes.blockmarkup.create(undefined, nodes[i]);
      }
    }
  }
  return nodes;
}

export function turn(
  tr: Transaction,
  $node: ResolvedPos,
  node: ProsemirrorNode
) {
  return tr.setNodeMarkup($node.before(), node.type, node.attrs, node.marks);
}

export function wrap(
  tr: Transaction,
  $node: ResolvedPos,
  node: ProsemirrorNode
) {
  const range = $node.blockRange();
  if (range) {
    const wrapping = findWrapping(range, node.type, node.attrs);
    if (wrapping) {
      return tr.wrap(range, wrapping);
    }
  }
}

export function unwrap(
  tr: Transaction,
  $node: ResolvedPos,
  node: ProsemirrorNode
) {
  const start = $node.start();
  const first = $node.parent.childAfter(0);
  const last = $node.parent.childBefore($node.parent.content.size);
  const $first = tr.doc.resolve(start + first.offset);
  const $last = tr.doc.resolve(start + last.offset);

  const range = $first.blockRange($last);
  if (range) {
    const target = liftTarget(range);
    if (target !== undefined && target !== null) {
      return turn(tr.lift(range, target), $node, node);
    }
  }
}
