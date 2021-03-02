import {
  NodeType,
  Node as ProsemirrorNode,
  Fragment,
  Slice,
  Mark,
} from "prosemirror-model";
import {
  Transaction,
  EditorState,
  Selection,
  Plugin,
  PluginKey,
} from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { baseKeymap, Command } from "prosemirror-commands";
import { keydownHandler } from "prosemirror-keymap";

import { ExtensionSchema } from "../../../editor";

import { balancePairs, setup, text, textCollapse } from "./rules";
import {
  textBetween,
  sourceNode,
  textIndex,
  docCursor,
  udpateNode,
} from "./utils";

type State = {
  tr: Transaction;
  from: number;
  to: number;
  text: string;
};

export class ParagraphPlugin extends Plugin<State | null, ExtensionSchema> {
  readonly name = this.type.name;
  readonly schema = this.type.schema;

  constructor(public readonly type: NodeType<ExtensionSchema>) {
    super({
      key: new PluginKey(type.name),
      props: {
        handleTextInput(view, from, to, text) {
          const self = this as ParagraphPlugin;
          return self.handleTextInput(view, from, to, text);
        },

        handlePaste(view, event, slice) {
          const self = this as ParagraphPlugin;
          return self.handlePaste(view, event, slice);
        },

        handleKeyDown: function (view, event) {
          const self = this as ParagraphPlugin;
          return self.handleKeyDown(view, event) || false;
        },
      },
      // appendTransaction(trs, _, state) {
      //   for (let i = trs.length - 1; i >= 0; --i) {
      //     const index: number | undefined = trs[i].getMeta("index");
      //     if (index !== undefined) {
      //       const $cursor = state.doc.resolve(docCursor(state.doc, index));
      //       return state.tr.setSelection(Selection.near($cursor));
      //     }
      //   }
      // },
    });
  }

  private handleBackspace: Command = (state, dispatch) => {
    let { from, to, empty } = state.selection;
    if (empty && from <= 1) {
      return false;
    }

    if (empty) {
      while (--from > 0) {
        const $from = state.doc.resolve(from);
        if ($from.parent !== $from.doc) {
          break;
        }
      }
      if (from === 0) {
        return false;
      }
    }

    const tr = this.transform(state, from, to);
    if (!tr) {
      return false;
    }

    dispatch?.(tr.scrollIntoView());
    return true;
  };

  private handleDelete: Command = (state, dispatch) => {
    const size = state.doc.content.size;
    let { from, to, empty } = state.selection;
    if (empty && to >= size) {
      return false;
    }

    if (empty) {
      while (++to < size) {
        const $to = state.doc.resolve(to);
        if ($to.parent !== $to.doc) {
          break;
        }
      }
      if (to === size) {
        return false;
      }
    }

    const tr = this.transform(state, from, to);
    if (!tr) {
      return false;
    }

    dispatch?.(tr.scrollIntoView());
    return true;
  };

  private handleEnter: Command = (state, dispatch) => {
    const { from, to } = state.selection;
    const tr = this.transform(state, from, to, "\n");
    if (!tr) {
      return false;
    }

    dispatch?.(tr.scrollIntoView());
    return true;
  };

  private keydownHandlers = keydownHandler({
    Backspace: this.handleBackspace,
    Delete: this.handleDelete,
    Enter: this.handleEnter,
  });

  handleKeyDown = (view: EditorView, event: KeyboardEvent) => {
    return this.keydownHandlers(view, event);
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

    const tr = this.transform(view.state, from, to, text);
    if (!tr) {
      return false;
    }

    view.dispatch(tr.scrollIntoView());
    return true;
  };

  handlePaste = (view: EditorView, event: ClipboardEvent, slice: Slice) => {
    const { clipboardData } = event;
    const html = clipboardData?.getData("text/html");
    if (html) {
      console.warn("TODO: paste html", html);
    }

    const text =
      clipboardData?.getData("text/plain") ||
      textBetween(slice.content, 0, slice.content.size);
    if (!text) {
      return false;
    }

    const state = view.state;
    const { from, to } = state.selection;
    const tr = this.transform(state, from, to, text);
    if (!tr) {
      return false;
    }

    view.dispatch(tr.scrollIntoView());
    event.preventDefault();
    return true;
  };

  private transform(
    state: EditorState,
    from: number,
    to: number,
    text?: string
  ) {
    const tr = text
      ? state.tr.replace(
          from,
          to,
          new Slice(Fragment.from(this.schema.text(text)), 0, 0)
        )
      : state.tr.delete(from, to);

    const $node = sourceNode(tr, tr.mapping.map(from));
    if (!$node) {
      return null;
    }

    const index = textIndex(tr.doc, tr.mapping.map(to));
    if (!udpateNode(tr, $node)) {
      return null;
    }

    const $cursor = tr.doc.resolve(docCursor(tr.doc, index));
    return tr.setSelection(Selection.near($cursor));
  }
}

export class BasePlugin extends Plugin {
  constructor(name: string) {
    super({
      key: new PluginKey(name),
      props: {
        handleKeyDown: keydownHandler(baseKeymap),
      },
    });
  }
}

export function docPlugins(type: NodeType<ExtensionSchema>) {
  if (type !== type.schema.topNodeType) {
    throw new Error(`Should be top node, got ${type.name}`);
  }

  // only top node is promised to be loaded at last, so we are ordering rules in here
  const engine = type.schema.cached.engine;

  engine.core.ruler.insert({ name: "setup", handle: setup }, 0);
  engine.inline.ruler.insert({ name: "text", handle: text }, 0);
  engine.postInline.ruler.insert({ name: "balance", handle: balancePairs }, 0);
  engine.postInline.ruler.append({ name: "collapse", handle: textCollapse });

  return [new BasePlugin(type.name)];
}

export function paragraphPlugins(type: NodeType<ExtensionSchema>) {
  return [new ParagraphPlugin(type)];
}
