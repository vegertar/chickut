import {
  Fragment,
  Node as ProsemirrorNode,
  NodeType,
  ResolvedPos,
} from "prosemirror-model";
import { findWrapping, liftTarget } from "prosemirror-transform";
import { Transaction } from "prosemirror-state";
import { ExtensionSchema } from "../../../editor";

export function textBetween(
  node: ProsemirrorNode | Fragment,
  from: number,
  to: number,
  nodeStart = 0
) {
  let texts: string[] = [];

  for (let i = 0, pos = 0; pos < to; i++) {
    const child = node.child(i);
    const end = pos + child.nodeSize;
    if (end > from) {
      if (child.isText && child.text) {
        texts.push(child.text.slice(from, to));
      } else if (child.isBlock) {
        if (!child.content.size) {
          texts.push("");
        } else if (child.content.size) {
          const start = pos + 1;
          texts.push(
            textBetween(
              child,
              Math.max(0, from - start),
              Math.min(child.content.size, to - start),
              nodeStart + start
            )
          );
        }

        if (child.type.name !== "blockmarkup") {
          texts.push("\n");
        }
      }
    }
    pos = end;
  }

  if (texts[texts.length - 1] === "\n") {
    texts.pop();
  }
  return texts.join("");
}

function isMarkup(node: ProsemirrorNode) {
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

export function sourceNode(
  tr: Transaction,
  head: number,
  cursor: number,
  deletion: boolean
) {
  const res: { $node?: ResolvedPos; cursor: number } = { cursor };

  if (head < 1) {
    res.$node = tr.doc.resolve(1);
    return res;
  }

  // TODO: optimize: source if and only if markup letters appear between [head, cursor)

  let $head = tr.doc.resolve(head);
  const headNode = tr.doc.nodeAt(head) || $head.parent;
  const markupType = isMarkup(headNode);
  if (markupType === 0 || markupType === 1) {
    res.$node = headNode.isText ? tr.doc.resolve($head.start()) : $head;
    return res;
  }

  // if (!deletion) {
  //   if (!$head.nodeAfter || $head.nodeAfter.textContent.startsWith(" ")) {
  //     res.cursor += 2; // jump out of blockmarkup from right
  //   } else if (!$head.nodeBefore || $head.nodeBefore.marks.length === 0) {
  //     res.cursor += 1; // jump into blockmarkup from left
  //   }
  // }

  while (true) {
    const node = $head.parent;
    if (!node.isBlock) {
      return res;
    }

    if (!node.isTextblock) {
      break;
    }

    $head = tr.doc.resolve($head.before());
  }

  res.$node = $head;
  return res;
}

function isContainer({ type }: ProsemirrorNode) {
  return type.isBlock && !type.isTextblock && !type.isLeaf;
}

function joinNextParagraph(
  tr: Transaction,
  $curr: ResolvedPos,
  next: ProsemirrorNode
) {
  const a = $curr.parent.lastChild;
  if (!a || a.type.name !== "paragraph" || next.childCount < 2) {
    return false;
  }

  const b = next.child(0);
  const c = next.child(1);
  if (b.type.name !== "blockmarkup" || c.type !== a.type) {
    return false;
  }

  const schema = a.type.schema as ExtensionSchema;
  let index = $curr.pos + $curr.parent.content.size;
  tr.insert(index - 1, schema.text("\n"));
  next.forEach((node, offset, i) => {
    if (i < 2) {
      tr.insert(index, node.content);
      index += node.content.size;
    } else {
      tr.insert(index, node);
      index += node.nodeSize;
    }
  });
  return true;
}

export function joinContainer(tr: Transaction, pos: number, cursor: number) {
  const $curr = tr.doc.resolve(pos);
  if (!isContainer($curr.parent)) {
    return cursor;
  }

  const after = $curr.after();
  const next = tr.doc.nodeAt(after);
  if (next && next.type === $curr.parent.type) {
    tr.deleteRange(after, after + next.content.size);
    if (!joinNextParagraph(tr, $curr, next)) {
      tr.insert($curr.pos + $curr.parent.content.size, next.content);
    }
  }

  const start = $curr.start();
  const $before = start <= 1 ? null : tr.doc.resolve(start - 2);
  if (!$before || $before.parent.type !== $curr.parent.type) {
    return cursor;
  }

  const before = $before.parent;
  tr.deleteRange($before.start(), $before.end()).insert(
    start - before.nodeSize,
    before.content
  );

  return cursor - 2;
}

// function mergeMarkup(node: ProsemirrorNode, markup: Fragment, right = false) {
//   const i = right ? node.content.size : 0;
//   if (node.type.isTextblock) {
//     node = node.replace(i, i, new Slice(markup, 0, 0));
//   } else if (node.type.isBlock) {
//     const child = node.nodeAt(i);
//     if (child) {
//       node = node.replace(
//         right ? i - child.content.size : 0,
//         right ? i : child.content.size,
//         new Slice(Fragment.from(mergeMarkup(child, markup, right)), 0, 0)
//       );
//     }
//   } else {
//     throw new Error(`Unexpected Node Type: ${node.type.name}`);
//   }

//   return node;
// }

// export function setBlockMarkup(type: NodeType, nodes: ProsemirrorNode[]) {
//   if (type.isBlock && !type.isTextblock) {
//     for (let i = 0; i < nodes.length; ++i) {
//       if (nodes[i].type.isText && !type.validContent(Fragment.from(nodes[i]))) {
//         const schema = type.schema as ExtensionSchema;
//         nodes[i] = schema.nodes.blockmarkup.create(undefined, nodes[i]);
//       }
//     }
//   }
//   return nodes;
// }

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
  return tr.setNodeMarkup($node.pos - 1, node.type, node.attrs, node.marks);
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
  const n = $node.parent.childCount;
  const $first = tr.doc.resolve($node.pos + 1);
  let $last: ResolvedPos | undefined;
  $node.parent.forEach((child, offset, i) => {
    if (i === n - 1) {
      $last = tr.doc.resolve($first.pos + offset);
    }
  });

  const range = $first.blockRange($last);
  if (range) {
    const target = liftTarget(range);
    if (target !== undefined && target !== null) {
      return turn(tr.lift(range, target), $node, node);
    }
  }
}
