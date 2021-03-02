import {
  Fragment,
  Mark,
  Node as ProsemirrorNode,
  NodeType,
  ResolvedPos,
  Slice,
} from "prosemirror-model";
import {
  findWrapping,
  liftTarget,
  ReplaceStep,
  Step,
} from "prosemirror-transform";
import { Transaction } from "prosemirror-state";

import { dmp, Env, ExtensionSchema, Token } from "../../../editor";
import diff from "./diff";

// when f returns true, the texts iterating aborts
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

export function checkMarkup(node: ProsemirrorNode): MARKUP_TYPE {
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
  let node = $node.parent;

  const markupType = checkMarkup(node.nodeAt($node.parentOffset) || node);
  if (markupType !== 2) {
    return $node;
  }

  while (true) {
    if (!node.isBlock) {
      return null;
    }
    if (!node.isTextblock && node.type.spec.group === "block") {
      break;
    }
    $node = tr.doc.resolve($node.before());
    node = $node.parent;
  }

  return $node;
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
  {
    type,
    attrs,
    marks,
  }: { type?: NodeType; attrs?: Record<string, any>; marks?: Mark[] }
) {
  return tr.setNodeMarkup($node.before(), type, attrs, marks);
}

export function wrap(
  tr: Transaction,
  $node: ResolvedPos,
  { type, attrs }: { type: NodeType; attrs?: Record<string, any> }
) {
  const range = $node.blockRange();
  if (range) {
    const wrapping = findWrapping(range, type, attrs);
    if (wrapping) {
      return tr.wrap(range, wrapping);
    }
  }
}

export function lift(tr: Transaction, $node: ResolvedPos) {
  const start = $node.start();
  const first = $node.parent.childAfter(0);
  const last = $node.parent.childBefore($node.parent.content.size);
  const $first = tr.doc.resolve(start + first.offset + 1);
  const $last = tr.doc.resolve(start + last.offset + 1);

  const range = $first.blockRange($last);
  if (range) {
    const target = liftTarget(range);
    if (target !== undefined && target !== null) {
      return tr.lift(range, target);
    }
  }
}

export function unwrap(
  tr: Transaction,
  $node: ResolvedPos,
  to?: { type?: NodeType; attrs?: Record<string, any>; marks?: Mark[] }
) {
  let fragment = $node.parent.content;
  if (to) {
    const nodes: ProsemirrorNode[] = [];
    fragment.forEach((node) => {
      const type = to.type || node.type;
      nodes.push(type.createChecked(to.attrs, node.content, to.marks));
    });
    if (nodes.length) {
      fragment = Fragment.from(nodes);
    }
  }

  return tr.step(
    new ReplaceStep(
      $node.before(),
      $node.after(),
      new Slice(fragment, $node.depth - 1, $node.depth - 1)
    )
  );
}

type ParseContext = {
  type: NodeType | null;
  content: ProsemirrorNode[];
  marks: Mark[];
  token?: Token;
};

function createNodes(
  schema: ExtensionSchema,
  token: Token,
  marks: Mark[]
): ProsemirrorNode[] {
  // TODO: image has nested alt field, e.g. ![foo ![bar](/url)](/url2)
  const { name, attrs, content } = token;
  const nodes: ProsemirrorNode[] = [];
  const nodeType = schema.nodes[name];

  if (name !== "text") {
    if (!nodeType) {
      marks = schema.marks[name].create(attrs).addToSet(marks);
    }

    if (content) {
      nodes.push(schema.text(content, marks));
    }

    if (nodeType) {
      nodes.push(nodeType.createChecked(attrs, nodes.splice(0), marks));
    }
  } else if (content) {
    nodes.push(schema.text(content, marks));
  }

  return nodes;
}

function parseTokens(
  schema: ExtensionSchema,
  tokens: Token[],
  context: ParseContext
) {
  const stack = [context];

  for (const token of tokens) {
    const current = stack[stack.length - 1];

    switch (token.nesting) {
      case 1: {
        const newItem: ParseContext = {
          type: schema.nodes[token.name] || null,
          content: [],
          marks: current.marks,
          token,
        };
        if (!newItem.type) {
          newItem.marks = schema.marks[token.name]
            .create(token.attrs)
            .addToSet(current.marks);
        }
        stack.push(newItem);
        break;
      }

      case 0: {
        if (token.name === "") {
          token.children && parseTokens(schema, token.children, current);
        } else {
          current.content.push(...createNodes(schema, token, current.marks));
        }
        break;
      }

      case -1: {
        const { type, content, marks, token: openToken } = stack.pop()!;
        const last = stack[stack.length - 1];
        if (type) {
          last.content.push(
            type.createChecked(
              openToken!.attrs,
              setBlockMarkup(type, content),
              marks
            )!
          );
        } else {
          last.content.push(...content);
        }
        break;
      }
    }
  }

  return context;
}

export function parseNode(node: ProsemirrorNode, env: Env = {}) {
  const schema = node.type.schema as ExtensionSchema;
  const source = textBetween(node, 0, node.content.size);
  const tokens = schema.cached.engine.parse(source, env);
  if (!tokens.length) {
    return null;
  }

  const { content } = parseTokens(schema, tokens, {
    type: node.type,
    content: [],
    marks: Mark.none,
  });

  return content.length ? content : null;
}

export function udpateNode(tr: Transaction, $node: ResolvedPos) {
  const node = $node.parent;
  const content = parseNode(node);
  if (!content) {
    return null;
  }

  const [head, ...tail] = content;

  let wrapped = false;
  let unwrapped = false;
  let reranged = false;

  if (!node.sameMarkup(head)) {
    if (head.type.validContent(node.content)) {
      turn(tr, $node, head);
    } else if (head.type.validContent(Fragment.from(node))) {
      wrapped = !!wrap(tr, $node, head);
    } else if (node.type.validContent(Fragment.from(head))) {
      unwrapped = !!unwrap(tr, $node, head);
    } else {
      reranged = true;
    }
  }

  const start = $node.start();
  const end = $node.end();

  if (reranged) {
    tr.replaceRangeWith(start, end, head);
  } else {
    tr.replaceWith(
      start,
      end + (wrapped ? 1 : 0) + (unwrapped ? -1 : 0),
      head.content
    );
  }

  let $container = get$Container(tr, tr.doc.resolve(start));
  if (tail.length) {
    let i = start + head.content.size + 1;
    const container = $container.parent;
    for (const item of tail) {
      const mergeable = item.sameMarkup(container);
      tr.insert(i, mergeable ? item.content : item);
      i += mergeable ? item.content.size : item.nodeSize;
    }

    $container = get$Container(tr, tr.doc.resolve(start));
  }

  if ($container.depth) {
    const container = $container.parent;
    const final = parseNode(container);
    if (final && final.length === 1) {
      diff(container, final[0]);
    }
  }

  return tr;
}
