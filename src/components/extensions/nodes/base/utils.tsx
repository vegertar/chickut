import {
  Fragment,
  Node as ProsemirrorNode,
  ResolvedPos,
  Slice,
} from "prosemirror-model";
import { findWrapping, liftTarget } from "prosemirror-transform";
import { NodeSelection, Transaction } from "prosemirror-state";
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

export function sourceNode(tr: Transaction, head: number, cursor: number) {
  if (head < 1) {
    return tr.doc.resolve(1);
  }

  const headNode = tr.doc.nodeAt(head);
  if (!headNode) {
    return null;
  }

  // TODO: optimize: source if and only if markup letters appear between [head, cursor)

  let $head = tr.doc.resolve(head);
  const markupType = isMarkup(headNode);
  if (markupType === 0 || markupType === 1) {
    return headNode.isText ? tr.doc.resolve($head.start()) : $head;
  }

  while (true) {
    const node = $head.parent;
    if (!node.isBlock) {
      return null;
    }

    if (!node.isTextblock) {
      break;
    }

    $head = tr.doc.resolve($head.before());
  }

  return $head;
}

function mergeMarkup(node: ProsemirrorNode, markup: Fragment, right = false) {
  const i = right ? node.content.size : 0;
  if (node.type.isTextblock) {
    node = node.replace(i, i, new Slice(markup, 0, 0));
  } else if (node.type.isBlock) {
    const child = node.nodeAt(i);
    if (child) {
      node = node.replace(
        right ? i - child.content.size : 0,
        right ? i : child.content.size,
        new Slice(Fragment.from(mergeMarkup(child, markup, right)), 0, 0)
      );
    }
  } else {
    throw new Error(`Unexpected Node Type: ${node.type.name}`);
  }

  return node;
}

export function mergeBlockMarkup(nodes: ProsemirrorNode[]) {
  if (nodes.length > 1 && nodes[0].type.name === "blockmarkup") {
    nodes.splice(0, 2, mergeMarkup(nodes[1], nodes[0].content));
  }

  const j = nodes.length - 1;
  if (nodes.length > 1 && nodes[j].type.name === "blockmarkup") {
    nodes.splice(j - 1, 2, mergeMarkup(nodes[j - 1], nodes[j].content, true));
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
