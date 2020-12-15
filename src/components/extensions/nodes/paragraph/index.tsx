import {
  NodeSpec,
  NodeType,
  Schema,
  Node as ProsemirrorNode,
} from "prosemirror-model";
import { EditorState, Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { BlockRule, Engine, Token, useExtension } from "../../../editor";

import "./style.scss";

export default function Paragraph() {
  useExtension(Paragraph);

  return null;
}

Paragraph.node = {
  content: "inline*",
  group: "block",
  parseDOM: [{ tag: "p" }],
  toDOM: () => ["p", 0],
} as NodeSpec;

Paragraph.rule = {
  match: /(?<content>.*)/,
} as BlockRule;

Paragraph.plugins = (type: NodeType) => [
  new Plugin({
    props: {
      handleTextInput: (view, from, to, text) =>
        handleTextInput(type, view, from, to, text),
    },
  }),
];

function transform(
  nodeType: NodeType,
  state: EditorState<Schema>,
  tokens: Token[],
  from: number,
  to: number
) {
  const tr = state.tr;
  if (tokens.length === 0) {
    return tr;
  }

  const $from = state.doc.resolve(from);
  const stack: {
    type: NodeType;
    content: ProsemirrorNode[];
    attrs?: Record<string, any>;
  }[] = [{ type: $from.parent.type, content: [] }];

  for (const token of tokens) {
    switch (token.nesting) {
      case 1: {
        const type = state.schema.nodes[token.tag];
        stack.push({ type, content: [], attrs: token.attrs });
        break;
      }

      case 0: {
        if (token.content && token.type === "inline") {
          stack[stack.length - 1].content.push(
            state.schema.text(token.content)
          );
        }
        break;
      }

      case -1: {
        const { type, content, attrs } = stack.pop()!;
        const node = type.createAndFill(attrs, content);
        node && stack[stack.length - 1].content.push(node);
        break;
      }
    }
  }

  const {
    type,
    content: [head, ...tail],
  } = stack[0];

  if (head.type === nodeType) {
    tr.deleteRange(from, to).insertText(head.textContent);
  } else if (type !== head.type && from === $from.start()) {
    tr.replaceRangeWith(from, to, head);
  } else {
    console.warn("TODO:", type, head);
  }

  if (tail.length) {
    tr.insert(to, tail);
  }

  return tr;
}

function handleTextInput(
  nodeType: NodeType,
  view: EditorView<Schema>,
  from: number,
  to: number,
  text: string
) {
  if (view.composing) {
    // TODO: what is composition?
    return false;
  }

  const state = view.state;
  const $from = state.doc.resolve(from);
  const spec = $from.parent.type.spec;
  if (spec.code) {
    return false;
  }

  const textBefore = $from.parent.textBetween(
    Math.max(0, $from.parentOffset - 500), // backwards maximum 500
    $from.parentOffset,
    undefined,
    "\ufffc"
  );

  console.log(textBefore, text, from, to);

  const engine = state.schema.cached.engine as Engine;
  const tokens = engine.expand(engine.parse(text));
  if (!tokens.length) {
    return false;
  }

  const tr = transform(nodeType, state, tokens, from, to);
  tr.docChanged && view.dispatch(tr);
  return true;
}
