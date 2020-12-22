import {
  NodeType,
  Node as ProsemirrorNode,
  Fragment,
  Slice,
} from "prosemirror-model";
import { EditorState, Plugin, PluginKey } from "prosemirror-state";
import { ReplaceAroundStep } from "prosemirror-transform";
import { EditorView } from "prosemirror-view";

import { Schema, Token } from "../../../editor";

type ParseContext = {
  type: NodeType;
  content: ProsemirrorNode[];
  attrs?: Record<string, any>;
};

class ParagraphPlugin extends Plugin {
  constructor(public readonly type: NodeType) {
    super({
      key: new PluginKey(type.name),
      state: {
        init() {
          return null;
        },
        apply(tr, prev) {
          return (
            tr.getMeta(this) || (tr.selectionSet || tr.docChanged ? null : prev)
          );
        },
      },
      props: {
        handleTextInput(view, from, to, text) {
          const self = this as ParagraphPlugin;
          return self.handleTextInput(view, from, to, text);
        },
      },
    });
  }

  handleTextInput(
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

    const engine = state.schema.cached.engine;
    const tokens = engine.parse(textBefore + text, { typing: true });

    const tr = this.transform(state, tokens, from - textBefore.length, to);
    tr && view.dispatch(tr.setMeta(this, { tr, from, to, text }));
    return !!tr;
  }

  transform(
    state: EditorState<Schema>,
    tokens: Token[],
    from: number,
    to: number
  ) {
    if (tokens.length === 0) {
      return;
    }

    const $from = state.doc.resolve(from);
    const {
      type,
      content: [head, ...tail],
    } = this.parse(state.schema, tokens, {
      type: $from.parent.type,
      content: [],
    });

    const tr = state.tr;
    if (head.type === this.type) {
      tr.delete(from, to).insertText(head.textContent);
    } else if (from === $from.start()) {
      if (type !== head.type) {
        tr.replaceRangeWith(from, to, head);
      } else {
        tr.delete(from, to).step(
          new ReplaceAroundStep(
            tr.mapping.map($from.before()),
            tr.mapping.map($from.after()),
            tr.mapping.map($from.start()),
            tr.mapping.map($from.end()),
            new Slice(Fragment.from(head), 0, 0),
            1,
            true
          )
        );
      }
    } else {
      console.warn("TODO:", type, head.type);
    }

    if (tail.length) {
      tr.insert(to, tail);
    }

    return tr.scrollIntoView();
  }

  parse(schema: Schema, tokens: Token[], context: ParseContext) {
    const stack = [context];

    for (const token of tokens) {
      switch (token.nesting) {
        case 1: {
          const type = schema.nodes[token.name];
          stack.push({ type, content: [], attrs: token.attrs });
          break;
        }

        case 0: {
          if (token.content) {
            const content = schema.text(token.content);
            const type = token.name ? schema.nodes[token.name] : null;
            stack[stack.length - 1].content.push(
              type?.createAndFill(token.attrs, content) || content
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

    return context;
  }
}

export default function plugins(type: NodeType) {
  return [new ParagraphPlugin(type)];
}
