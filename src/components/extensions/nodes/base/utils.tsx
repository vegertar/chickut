import {
  Fragment,
  Mark,
  Node as ProsemirrorNode,
  NodeType,
} from "prosemirror-model";

import { Env, ExtensionSchema, Token } from "../../../editor";

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

export function parseContent(node: ProsemirrorNode, env: Env = {}) {
  const schema = node.type.schema as ExtensionSchema;
  const source = textBetween(node, 0, node.content.size);
  const tokens = schema.cached.engine.parse(source, env);
  if (!tokens.length) {
    return;
  }

  const { content } = parseTokens(schema, tokens, {
    type: node.type,
    content: [],
    marks: Mark.none,
  });

  return content;
}
