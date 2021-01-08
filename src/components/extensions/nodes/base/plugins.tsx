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
  trimSplit,
  ExtensionSchema,
} from "../../../editor";
import { balancePairs, setup, text, textCollapse } from "./rules";

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

function toText(node: ProsemirrorNode, start: number, end: number) {
  let textWithoutMarkup = "";
  let textWithMarkup = "";

  const text = node.text?.slice(start, end);
  if (text) {
    textWithoutMarkup += text;
    textWithMarkup += node.marks.reduce((s, mark) => {
      const toText = (mark.type.spec as ExtensionMarkSpec).toText;
      if (!toText) {
        return s;
      }
      const [left, x, right] = trimSplit(s);
      return `${left}${toText(mark, x)}${right}`;
    }, text);
  }

  return [textWithoutMarkup, textWithMarkup];
}

function nodeToText(node: ProsemirrorNode, start = 0, end = node.content.size) {
  if (node.isText && node.text) {
    return toText(node, start, end || node.text.length);
  }

  let textWithoutMarkup = "";
  let textWithMarkup = "";

  node.nodesBetween(
    start,
    end,
    (node, pos) => {
      if (node.isText && node.text) {
        const [a, b] = toText(node, Math.max(start, pos) - pos, end - pos);
        textWithoutMarkup += a;
        textWithMarkup += b;
      } else if (node.isLeaf) {
        textWithoutMarkup += "\ufffc";
      }
    },
    0
  );

  return [textWithoutMarkup, textWithMarkup];
}

function sliceToText(slice: Slice) {
  if (slice === Slice.empty) {
    return "";
  }

  const content: string[] = [];
  slice.content.forEach((node) => {
    content.push(nodeToText(node)[1]);
  });
  return content.join("\n");
}

function textBefore($from: ResolvedPos, max = 500) {
  const end = $from.parentOffset;
  const start = Math.max(0, end - max);
  return nodeToText($from.parent, start, end);
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

    return this.text(view, from, to, text, true);
  };

  handlePaste = (view: EditorView, event: ClipboardEvent, slice: Slice) => {
    const { clipboardData } = event;
    const html = clipboardData?.getData("text/html");
    if (html) {
      console.warn("TODO: paste html", html);
    }

    const text = clipboardData?.getData("text/plain") || sliceToText(slice);
    if (!text) {
      return false;
    }

    const { from, to } = view.state.selection;
    const ok = this.text(view, from, to, text);
    ok && event.preventDefault();
    return ok;
  };

  private text(
    view: EditorView,
    from: number,
    to: number,
    text: string,
    typing = false
  ) {
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
      textWithMarkup + text,
      typing
    );

    ok &&
      view.dispatch(
        tr.setMeta(this, { tr, from, to, text, typing }).scrollIntoView()
      );
    return ok;
  }

  private transform(
    tr: Transaction,
    start: number,
    end: number,
    text: string,
    typing?: boolean
  ) {
    const tokens = this.engine.parse(text, { tr, typing });
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

    return true;
  }

  private parse(tokens: Token[], context: ParseContext) {
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

  private parseInline(tokens: Token[], nodes: ProsemirrorNode[]) {
    const stack = [Mark.none];

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
            if (token.name === "text") {
              nodes.push(this.schema.text(token.content, marks));
            } else {
              // TODO: image has nested alt field, e.g. ![foo ![bar](/url)](/url2)
              const type = this.schema.nodes[token.name];
              nodes.push(type.createChecked(token.attrs, undefined, marks));
            }
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

export default function plugins(type: NodeType<ExtensionSchema>) {
  if (type !== type.schema.topNodeType) {
    throw new Error(`Should be top node, got ${type.name}`);
  }

  // only top node is promised to load at last, so we are ordering rules in here
  const engine = type.schema.cached.engine;

  engine.core.ruler.insert({ name: "setup", handle: setup }, 0);
  engine.inline.ruler.insert({ name: "text", handle: text }, 0);
  engine.postInline.ruler.insert({ name: "balance", handle: balancePairs }, 0);
  engine.postInline.ruler.append({ name: "collapse", handle: textCollapse });

  return [new BasePlugin(type.name)];
}
