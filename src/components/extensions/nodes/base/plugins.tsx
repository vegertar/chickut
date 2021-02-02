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

import { Token, ExtensionSchema } from "../../../editor";

import { balancePairs, setup, text, textCollapse } from "./rules";
import { resolvePos, nodeToText } from "./utils";

type ParseContext = {
  type: NodeType | null;
  content: ProsemirrorNode[];
  marks: Mark[];
  token?: Token;
};

type State = {
  tr: Transaction;
  from: number;
  to: number;
  text: string;
};

export class ParagraphPlugin extends Plugin<State | null, ExtensionSchema> {
  readonly name = this.type.name;
  readonly engine = this.type.schema.cached.engine;
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
    });
  }

  private handleBackspace: Command = (state, dispatch) => {
    let { from, to, empty } = state.selection;
    if (empty) {
      if (from > 1) {
        --from;
      } else {
        return false;
      }
    }

    const tr = this.transform(state, from, to, "");
    if (tr) {
      dispatch?.(tr);
      return true;
    }

    return false;
  };

  private keydownHandlers = keydownHandler({
    Backspace: this.handleBackspace,
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
      nodeToText(slice.content, 0, slice.content.size);
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
    text: string
  ) {
    let tr = state.tr.insertText(text, from, to);
    const cursor = tr.mapping.map(to);

    // as the new inserted text might be changing the whole block rendering,
    // e.g. "*" into middle of "*hello*world*", we have to find range up to the same parent node
    // TODO: for reference changing, the whole doc might be affected
    const $target = resolvePos(tr.doc, tr.mapping.map(from), cursor);

    const target = $target.parent;
    const source = target.textContent; // nodeToText(parent, 0, parent.content.size);
    const tokens = this.engine.parse(source);
    if (!tokens.length) {
      return null;
    }

    const { content } = this.parse(tokens, {
      type: $target.parent.type,
      content: [],
      marks: Mark.none,
    });
    if (!content.length) {
      return null;
    }

    const start = $target.start();
    const end = $target.end();

    if (start > 0) {
      let pos = start - 1;
      for (const node of content) {
        tr.setNodeMarkup(pos, node.type, node.attrs, node.marks);
        // TODO:
        break;
      }

      tr.setSelection(Selection.near(tr.doc.resolve(cursor)));
    } else {
      tr.replaceRange(start, end, new Slice(Fragment.from(content), 0, 0));
    }

    return tr;
  }

  private parse(tokens: Token[], context: ParseContext) {
    const stack = [context];

    for (const token of tokens) {
      const current = stack[stack.length - 1];

      switch (token.nesting) {
        case 1: {
          const newItem: ParseContext = {
            type: this.schema.nodes[token.name] || null,
            content: [],
            marks: current.marks,
            token,
          };
          if (!newItem.type) {
            newItem.marks = this.schema.marks[token.name]
              .create(token.attrs)
              .addToSet(current.marks);
          }
          stack.push(newItem);
          break;
        }

        case 0: {
          if (token.name === "") {
            token.children && this.parse(token.children, current);
          } else {
            current.content.push(...this.createNodes(token, current.marks));
          }
          break;
        }

        case -1: {
          const { type, content, marks, token: openToken } = stack.pop()!;
          const marked = [
            ...this.createNodes(openToken!, marks),
            ...content,
            ...this.createNodes(token, marks),
          ];
          const last = stack[stack.length - 1];
          if (type) {
            last.content.push(
              type.createAndFill(openToken!.attrs, marked, marks)!
            );
          } else {
            last.content.push(...marked);
          }
          break;
        }
      }
    }

    return context;
  }

  private createNodes(token: Token, marks: Mark[]): ProsemirrorNode[] {
    // TODO: image has nested alt field, e.g. ![foo ![bar](/url)](/url2)
    const { name, attrs, nesting, content, markup } = token;
    const nodes: ProsemirrorNode[] = [];
    const nodeType = this.schema.nodes[name];
    const { markupPosition = nesting } = attrs || {};

    switch (nesting) {
      case 0:
        if (name !== "text") {
          if (nodeType) {
            nodes.push(
              nodeType.createChecked(
                attrs,
                content ? this.schema.text(content) : undefined,
                marks
              )
            );
          } else {
            marks = this.schema.marks[name].create(attrs).addToSet(marks);
            const marker = markup && this.createMarkup(markup, marks);

            if (marker && markupPosition >= 0) {
              nodes.push(marker);
            }
            if (content) {
              nodes.push(this.schema.text(content, marks));
            }
            if (marker && markupPosition <= 0) {
              nodes.push(marker);
            }
          }
        } else if (content) {
          nodes.push(this.schema.text(content, marks));
        }
        break;

      case 1:
      case -1:
        if (markup && markupPosition === nesting) {
          const marker = this.schema.text(
            markup,
            this.schema.marks.markup.create().addToSet(marks)
          );
          if (!nodeType || nodeType.isTextblock) {
            nodes.push(marker);
          } else if (nodeType.isBlock) {
            const p = this.createMarkedParagraph(marker);
            if (nodeType.validContent(Fragment.from(p))) {
              nodes.push(p);
            }
          }
        }
        break;
    }

    return nodes;
  }

  private createMarkup(markup: string, marks: Mark[]) {
    return this.schema.text(
      markup,
      this.schema.marks.markup.create().addToSet(marks)
    );
  }

  private createMarkedParagraph(marker: ProsemirrorNode) {
    return this.type.create({ marker: true }, marker);
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
