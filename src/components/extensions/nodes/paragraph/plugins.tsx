import {
  NodeType,
  Node as ProsemirrorNode,
  Fragment,
  Slice,
} from "prosemirror-model";
import { EditorState, Transaction } from "prosemirror-state";
import { ReplaceAroundStep } from "prosemirror-transform";
import { EditorView } from "prosemirror-view";

import { ExtensionPlugin, ExtensionSchema, Token } from "../../../editor";

type ParseContext = {
  type: NodeType;
  content: ProsemirrorNode[];
  attrs?: Record<string, any>;
};

type State = {
  tr: Transaction;
  from: number;
  to: number;
  text: string;
};

class ParagraphPlugin extends ExtensionPlugin<State | null> {
  initState = () => {
    return null;
  };

  applyState = (tr: Transaction<ExtensionSchema>, prev: State | null) => {
    return tr.getMeta(this) || (tr.selectionSet || tr.docChanged ? null : prev);
  };

  handleTextInput = (
    view: EditorView<ExtensionSchema>,
    from: number,
    to: number,
    text: string
  ) => {
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

    const tr = state.tr;
    const textBefore = this.textBefore($from);

    if (this.transform(tr, textBefore + text, from - textBefore.length, to)) {
      view.dispatch(tr.setMeta(this, { tr, from, to, text }));
      return true;
    }

    return false;
  };

  transform(
    tr: Transaction<ExtensionSchema>,
    text: string,
    start: number,
    end: number
  ) {
    const tokens = this.engine.parse(text, { tr, typing: true });
    if (tokens.length === 0) {
      return false;
    }

    const $start = tr.doc.resolve(start);

    const {
      type,
      content: [head, ...tail],
    } = this.parse(this.schema, tokens, {
      type: $start.parent.type,
      content: [],
    });

    if (!head) {
      return false;
    }

    if (head.type === this.type) {
      tr.delete(start, end).insertText(head.textContent);
    } else if (start === $start.start()) {
      if (type !== head.type) {
        tr.replaceRangeWith(start, end, head);
      } else {
        tr.delete(start, end).step(
          new ReplaceAroundStep(
            tr.mapping.map($start.before()),
            tr.mapping.map($start.after()),
            tr.mapping.map($start.start()),
            tr.mapping.map($start.end()),
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
      tr.insert(tr.mapping.map(end), tail);
    }

    tr.scrollIntoView();
    return true;
  }

  parse(schema: ExtensionSchema, tokens: Token[], context: ParseContext) {
    const stack = [context];

    for (const token of tokens) {
      switch (token.nesting) {
        case 1: {
          const type = schema.nodes[token.name];
          stack.push({ type, content: [], attrs: token.attrs });
          break;
        }

        case 0: {
          if (token.content || token.name) {
            const content = token.content ? schema.text(token.content) : null;
            const type = token.name ? schema.nodes[token.name] : null;
            const node =
              type && content
                ? type.createAndFill(token.attrs, content)
                : type?.create(token.attrs) || content;
            node && stack[stack.length - 1].content.push(node);
            // TODO: handle marks, i.e. token.children
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
