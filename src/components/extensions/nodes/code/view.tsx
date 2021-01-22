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

const onCreate = new Map<string, Handle<NodeView>>();
const onUpdate = new Map<string, Handle<string>>();
const onDestroy = new Map<string, Handle<string>>();
const onEvent = new Map<string, Handle<Event>>();

var seq = 0;

export class NodeView {
  readonly name: string;
  readonly id: string;
  readonly dom: HTMLElement;
  readonly cm: cm.EditorView;

  constructor(
    protected node: ProsemirrorNode,
    protected view: EditorView,
    protected getPos: () => number
  ) {
    this.name = node.type.name;
    this.id = `${node.type.name}-${new Date().getTime()}-${++seq}`;
    this.dom = document.createElement("div");
    this.dom.className = this.name;
    this.dom.id = this.id;

    this.cm = new cm.EditorView({
      parent: this.dom,
      state: cm.EditorState.create({
        extensions: [
          cm.basicSetup,
          lang(),
          cm.keymap.of(
            Object.entries(this.keymaps()).map(([key, run]) => ({
              key,
              run,
            }))
          ),
        ],
      }),
      dispatch: (tr) => {
        this.cm.update([tr]);
        if (tr.docChanged) {
          const tr = this.upwardChanges();
          tr && this.view.dispatch(tr);
          onUpdate.get(this.name)?.(this.id);
        }
      },
    });

    this.initEvent();
    this.render();

    onCreate.get(this.name)?.(this);
  }

  initEvent() {
    const handle: Handle<Event> = (event) => onEvent.get(this.name)?.(event);
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
    onDestroy.get(this.name)?.(this.id);
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

type State = {
  nodeViews: NodeView[];
  focused?: string;
  updated?: { id: string };
};

export function useView(name: string) {
  const [state, setState] = useState<State>({ nodeViews: [] });

  useEffect(() => {
    onCreate.set(name, (view) =>
      setState((state) =>
        produce(state, (draft: State) => {
          draft.nodeViews.push(view);
        })
      )
    );

    onUpdate.set(name, (id) =>
      setState((state) =>
        produce(state, (draft) => {
          draft.updated = { id };
        })
      )
    );

    onDestroy.set(name, (id) =>
      setState((views) =>
        produce(views, (draft) => {
          const index = draft.nodeViews.findIndex((view) => view.id === id);
          if (index !== -1) {
            draft.nodeViews.splice(index, 1);
          }
        })
      )
    );

    onEvent.set(name, (event) => {
      const { type, target } = event;
      const nameMatched =
        target instanceof HTMLElement && target.classList.contains(name);

      switch (type) {
        case "mouseenter":
          nameMatched &&
            setState((state) =>
              produce(state, (draft) => {
                draft.focused = (target as Element).id;
              })
            );
          break;
        case "mouseleave":
          nameMatched &&
            setState((state) =>
              produce(state, (draft) => {
                draft.focused = undefined;
              })
            );
          break;
      }
    });

    return () => {
      onCreate.delete(name);
      onUpdate.delete(name);
      onDestroy.delete(name);
      onEvent.delete(name);
    };
  }, [name]);

  return state;
}
