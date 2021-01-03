import {
  NodeType,
  Node as ProsemirrorNode,
  Fragment,
  Slice,
  Mark,
  ResolvedPos,
} from "prosemirror-model";
import { Transaction } from "prosemirror-state";
import { ReplaceAroundStep } from "prosemirror-transform";
import { EditorView } from "prosemirror-view";
import { baseKeymap } from "prosemirror-commands";
import { keydownHandler } from "prosemirror-keymap";

import {
  ExtensionPlugin,
  Token,
  Plugin,
  ExtensionMarkSpec,
} from "../../../editor";

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

function textBefore($from: ResolvedPos, max = 500) {
  let textWithoutMarkup = "";
  let textWithMarkup = "";

  const end = $from.parentOffset;
  const start = Math.max(0, end - max);

  $from.parent.nodesBetween(
    start,
    end,
    (node, pos) => {
      if (node.isText && node.text) {
        const text = node.text.slice(Math.max(start, pos) - pos, end - pos);
        textWithoutMarkup += text;
        textWithMarkup += node.marks.reduce((s, mark) => {
          const toText = (mark.type.spec as ExtensionMarkSpec).toText;
          return toText ? toText(mark, s) : s;
        }, text);
      } else if (node.isLeaf) {
        textWithoutMarkup += "\ufffc";
      }
    },
    0
  );

  return [textWithoutMarkup, textWithMarkup];
}

export class ParagraphPlugin extends ExtensionPlugin<State | null> {
  initState = () => {
    return null;
  };

  applyState = (tr: Transaction, prev: State | null) => {
    return tr.getMeta(this) || (tr.selectionSet || tr.docChanged ? null : prev);
  };

  handleTextInput = (
    view: EditorView,
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
    const [textWithoutMarkup, textWithMarkup] = textBefore($from);
    const ok = this.transform(
      tr,
      from - textWithoutMarkup.length,
      to,
      textWithMarkup + text
    );

    ok && view.dispatch(tr.setMeta(this, { tr, from, to, text }));
    return ok;
  };

  transform(tr: Transaction, start: number, end: number, text: string) {
    const tokens = this.engine.parse(text, { tr, typing: true });
    if (tokens.length === 0) {
      return false;
    }

    const $start = tr.doc.resolve(start);
    const {
      type,
      content: [head, ...tail],
    } = this.parse(tokens, { type: $start.parent.type, content: [] });

    if (!head) {
      return false;
    }

    if (head.type === this.type) {
      tr.replaceWith(start, end, head.content);
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

  parse(tokens: Token[], context: ParseContext) {
    const stack = [context];

    for (const token of tokens) {
      switch (token.nesting) {
        case 1: {
          const type = this.schema.nodes[token.name];
          stack.push({ type, content: [], attrs: token.attrs });
          break;
        }

        case 0: {
          const current = stack[stack.length - 1];
          if (!token.name && token.children?.length) {
            this.parseInline(token.children, current.content);
          } else if (token.name || token.content) {
            const content = token.content
              ? this.schema.text(token.content)
              : null;
            const type = token.name ? this.schema.nodes[token.name] : null;
            const node =
              type && content
                ? type.createAndFill(token.attrs, content)
                : type?.create(token.attrs) || content;
            node && current.content.push(node);
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

  parseInline(tokens: Token[], nodes: ProsemirrorNode[]) {
    const stack: Mark[][] = [Mark.none];

    console.log(tokens);
    for (const token of tokens) {
      switch (token.nesting) {
        case 1: {
          const type = this.schema.marks[token.name].create(token.attrs);
          stack.push(type.addToSet(stack[stack.length - 1]));
          break;
        }

        case 0:
          if (token.content) {
            const marks = stack[stack.length - 1];
            nodes.push(this.schema.text(token.content, marks));
          }
          break;

        case -1: {
          stack.pop();
          break;
        }
      }
    }
  }
}

export class BasePlugin extends Plugin {
  constructor(name: string) {
    super(name, {
      handleKeyDown: keydownHandler(baseKeymap),
    });
  }
}
