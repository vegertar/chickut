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
    if (!node.isTextblock && node.type.spec.group === "block") {
      break;
    }
    $node = tr.doc.resolve($node.before());
  }

  return $node;
}

function isContainer({ type }: ProsemirrorNode) {
  return type.isBlock && !type.isTextblock && !type.isLeaf;
}

function isJoinable({ type }: ProsemirrorNode) {
  return type.name === "blockmarkup" || type.name === "paragraph";
}

function canJoinBlock(block: ProsemirrorNode, next: ProsemirrorNode) {
  if (block.type.name !== "paragraph") {
    const a = block.lastChild;
    if (!a || a.type.name !== "paragraph") {
      return false;
    }

    return !!next.firstChild && isJoinable(next.firstChild);
  }

  for (let i = 0; i < next.childCount; ++i) {
    if (!isJoinable(next.child(i))) {
      return false;
    }
  }
  return true;
}

function joinNextBlock(
  tr: Transaction,
  $block: ResolvedPos,
  next: ProsemirrorNode
) {
  let index = $block.start();
  const block = $block.parent;
  if (block.type.name === "paragraph") {
    index += block.content.size + 1;
  } else {
    // get the last child position
    const { node, offset } = block.childBefore(block.content.size);
    index += offset + (node ? node.nodeSize : 0);
  }

  tr.insertText("\n", index - 1);

  let joinContent = true;
  for (let i = 0; i < next.childCount; ++i) {
    const node = next.child(i);
    if (joinContent && isJoinable(node)) {
      if (i > 0 && next.child(i - 1).type.name !== "blockmarkup") {
        tr.insertText("\n", index++);
      }
      tr.insert(index, node.content);
      index += node.content.size;
    } else {
      joinContent = false;
      tr.insert(index, node);
      index += node.nodeSize;
    }
  }
}

function joinParagraph(
  tr: Transaction,
  $paragraph: ResolvedPos,
  $container: ResolvedPos
) {
  if (
    $paragraph.parent.type.name !== "paragraph" ||
    $paragraph.depth - 1 !== $container.depth
  ) {
    return;
  }

  const container = $container.parent;
  const start = $container.start();

  const next = container.childAfter($paragraph.after() - start);
  if (next.node) {
    let j = next.index;
    let size = 0;
    for (; j < container.childCount; ++j) {
      const child = container.child(j);
      if (!isJoinable(child)) {
        break;
      }
      size += child.nodeSize;
    }

    const last = container.child(j - 1);
    if (size && last.type.name === "blockmarkup") {
      // remain the last blockmarkup alone
      --j;
      size -= last.nodeSize;
    }

    if (size) {
      let pos = start + next.offset;
      tr.delete(pos, pos + size);

      pos = $paragraph.end();
      tr.insertText("\n", pos);
      ++pos;
      for (let i = next.index; i < j; ++i) {
        const child = container.child(i);
        tr.insert(pos, child.content);
        pos += child.content.size;
      }
    }
  }

  const prev = container.childBefore($paragraph.before() - start);
  if (prev.node) {
    let j = prev.index;
    let size = 0;
    for (; j >= 0; --j) {
      const child = container.child(j);
      if (!isJoinable(child)) {
        break;
      }
      size += child.nodeSize;
    }

    const first = container.child(j + 1);
    if (size && first.type.name === "blockmarkup") {
      // remain the first blockmarkup alone
      ++j;
      size -= first.nodeSize;
    }

    if (size) {
      const curr = start + prev.offset + prev.node.nodeSize;
      for (let m = j + 1, n = next.index - 1, pos = curr + 1; m < n; ++m) {
        const child = container.child(m);
        tr.insert(pos, child.content);
        pos += child.content.size;
        if (child.type.name !== "blockmarkup") {
          tr.insertText("\n", pos++);
        }
      }
      tr.delete(curr - size, curr);
    }
  }
}

export function joinBlock(
  tr: Transaction,
  $block: ResolvedPos,
  $container: ResolvedPos
) {
  if (!$block.depth) {
    return;
  }

  let node = $block.parent;
  if (!isContainer(node)) {
    joinParagraph(tr, $block, $container);
    return;
  }

  const container = $container.parent;
  const containerStart = $container.start();

  const start = $block.start();
  const after = $block.after();
  const { node: next } = container.childAfter(after - containerStart);

  if (next && next.sameMarkup(node)) {
    tr.deleteRange(after, after + next.content.size);
    if (canJoinBlock(node, next)) {
      joinNextBlock(tr, $block, next);
    } else {
      tr.insert(start + node.content.size, next.content);
    }
    node = tr.doc.resolve(start).parent;
  }

  const { node: prev, offset } = container.childBefore(
    $block.before() - containerStart
  );

  if (!prev) {
    return;
  }

  const $prev = tr.doc.resolve(containerStart + offset + 1);
  let joinable = false;
  if ($prev.depth === $block.depth - 1) {
    console.log(node.toString());
  } else if (prev.sameMarkup(node)) {
    if (canJoinBlock(prev, node)) {
      joinable = true;
    } else {
      const before = $prev.parent;
      tr.insert(start, before.content).deleteRange($prev.start(), $prev.end());
    }
  } else if (container.sameMarkup(node) && canJoinBlock(prev, node)) {
    // e.g. turn 2nd blockquote to 1st blockquote within 1st blockquote container
    joinable = true;
  }

  if (joinable) {
    tr.deleteRange(start, start + node.content.size);
    joinNextBlock(tr, $prev, node);
  }
}

export function get$Container(tr: Transaction, $node: ResolvedPos) {
  while ($node.parent !== $node.doc) {
    $node = tr.doc.resolve($node.start(-1));
    if ($node.parent.type.spec.group === "block") {
      break;
    }
  }

  return $node;
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
