import { useEffect, useState } from "react";
import produce from "immer";
import { diff_match_patch } from "diff-match-patch";
import { Node as ProsemirrorNode } from "prosemirror-model";
import { EditorView } from "prosemirror-view";
import { Transaction } from "prosemirror-state";
import { exitCode } from "prosemirror-commands";

import * as cm from "./cm";
import lang from "./lang";

const dmp = new diff_match_patch();

type Handle<T> = ((event: T) => void) | undefined;

var onCreate: Handle<NodeView>;
var onChange: Handle<string>;
var onDestroy: Handle<string>;
var onEvent: Handle<Event>;

var seq = 0;

export class NodeView {
  readonly id: string;
  readonly dom: HTMLElement;
  readonly cm: cm.EditorView;

  constructor(
    protected node: ProsemirrorNode,
    protected view: EditorView,
    protected getPos: () => number
  ) {
    this.id = `${node.type.name}-${++seq}`;
    this.dom = document.createElement("div");
    this.dom.className = node.type.name;
    this.dom.id = this.id;

    this.cm = new cm.EditorView({
      parent: this.dom,
      state: cm.EditorState.create({
        extensions: [cm.basicSetup, lang()],
      }),
      dispatch: (tr) => {
        this.cm.update([tr]);
        if (tr.docChanged) {
          const tr = this.upwardChanges();
          tr && this.view.dispatch(tr);
          onChange?.(this.id);
        }
      },
    });

    this.initEvent();
    this.render();

    onCreate?.(this);
  }

  initEvent() {
    const handle: Handle<Event> = (event) => onEvent?.(event);
    this.dom.onmouseenter = handle;
    this.dom.onmouseleave = handle;
  }

  keymaps(): Record<string, cm.Command> {
    return {
      "Ctrl-Enter": () => {
        if (exitCode(this.view.state, this.view.dispatch)) {
          this.view.focus();
        }
        return true;
      },
    };
  }

  update(node: ProsemirrorNode) {
    if (node.type !== this.node.type) {
      return false;
    }
    this.node = node;
    return this.render() === false ? false : true;
  }

  destroy() {
    this.cm.destroy();
    onDestroy?.(this.id);
  }

  selectNode() {
    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>", this.node);
  }

  render(): boolean | void {
    const tr = this.downwardChanges();
    tr && this.cm.dispatch(tr);
  }

  downwardChanges() {
    const from = this.cm.state.doc.toString();
    const to = this.node.textContent;
    const steps: cm.ChangeSpec[] = [];

    let index = 0;
    for (const [op, text] of dmp.diff_main(from, to)) {
      switch (op) {
        case 1: // insert
          steps.push({ from: index, insert: text });
          break;
        case 0: // equal
          index += text.length;
          break;
        case -1: // delete
          steps.push({ from: index, to: index + text.length });
          index += text.length;
          break;
      }
    }

    return steps.length ? this.cm.state.update({ changes: steps }) : null;
  }

  upwardChanges() {
    const from = this.node.textContent;
    const to = this.cm.state.doc.toString();

    let index = this.getPos() + 1;
    let tr: Transaction | null = null;

    for (const [op, text] of dmp.diff_main(from, to)) {
      if (!tr) {
        tr = this.view.state.tr;
      }

      switch (op) {
        case 1: // insert
          tr.insertText(text, index);
          break;
        case 0: // equal
          index += text.length;
          break;
        case -1: // delete
          tr.delete(index, index + text.length);
          index += text.length;
          break;
      }
    }
    return tr;
  }
}

export function useView(name: string) {
  const [nodeViews, setViews] = useState<NodeView[]>([]);
  const [focus, setFocus] = useState<string>();
  const [change, setChange] = useState<string>();

  useEffect(() => {
    onCreate = (view) =>
      setViews((views) =>
        produce(views, (draft: NodeView[]) => {
          draft.push(view);
        })
      );
    onChange = (id) => setChange(id);
    onDestroy = (id) =>
      setViews((views) =>
        produce(views, (draft: NodeView[]) => {
          const index = draft.findIndex((view) => view.id === id);
          if (index !== -1) {
            draft.splice(index, 1);
          }
        })
      );
    return () => {
      onCreate = undefined;
      onChange = undefined;
      onDestroy = undefined;
    };
  }, []);

  useEffect(() => {
    onEvent = (event) => {
      const { type, target } = event;
      const nameMatched =
        target instanceof HTMLElement && target.classList.contains(name);

      switch (type) {
        case "mouseenter":
          nameMatched && setFocus((target as Element).id);
          break;
        case "mouseleave":
          nameMatched && setFocus(undefined);
          break;
      }
    };
    return () => (onEvent = undefined);
  }, [name]);

  return { nodeViews, focus, change };
}
