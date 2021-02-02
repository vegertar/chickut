import { useEffect, useState } from "react";
import produce from "immer";
import { Node as ProsemirrorNode } from "prosemirror-model";
import { NodeView as INodeView } from "prosemirror-view";
import { Transaction } from "prosemirror-state";
import { exitCode } from "prosemirror-commands";

import { NodeView as BaseNodeView, dmp } from "../../../editor";

import * as cm from "./cm";
import lang from "./lang";

export class NodeView extends BaseNodeView implements INodeView {
  contentDOM = null;

  readonly cm = new cm.EditorView({
    parent: this.dom,
    state: cm.EditorState.create({
      doc: this.node.textContent,
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
      }
    },
  });

  destroy() {
    this.cm.destroy();
    super.destroy();
  }

  render(old?: ProsemirrorNode): boolean | void {
    if (old) {
      const tr = this.downwardChanges();
      tr && this.cm.dispatch(tr);
    }
    return super.render(old);
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
    NodeView.createHandles.set(name, (view) =>
      setState((state) =>
        produce(state, (draft: State) => {
          draft.nodeViews.push(view as NodeView);
        })
      )
    );

    NodeView.updateHandles.set(name, (id) => {
      setState((state) =>
        produce(state, (draft) => {
          draft.updated = { id };
        })
      );
    });

    NodeView.destroyHandles.set(name, (id) =>
      setState((views) =>
        produce(views, (draft) => {
          const index = draft.nodeViews.findIndex((view) => view.id === id);
          if (index !== -1) {
            draft.nodeViews.splice(index, 1);
          }
        })
      )
    );

    return () => {
      NodeView.createHandles.delete(name);
      NodeView.updateHandles.delete(name);
      NodeView.destroyHandles.delete(name);
    };
  }, [name]);

  return state;
}
