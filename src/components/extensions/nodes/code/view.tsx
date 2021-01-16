import { Node as ProsemirrorNode } from "prosemirror-model";
import { EditorView } from "prosemirror-view";
import { Transaction } from "prosemirror-state";
import { exitCode } from "prosemirror-commands";

import {
  ChangeSpec as CMChangeSpec,
  EditorState as CMEditorState,
} from "@codemirror/state";
import {
  EditorView as CMEditorView,
  keymap as CMkeymap,
  Command as CMCommand,
} from "@codemirror/view";
import { defaultKeymap as CMdefaultKeymap } from "@codemirror/commands";

import { diff_match_patch } from "diff-match-patch";

const dmp = new diff_match_patch();

export class NodeView {
  readonly cm: CMEditorView;
  readonly dom: HTMLElement;

  constructor(
    protected node: ProsemirrorNode,
    protected view: EditorView,
    protected getPos: () => number
  ) {
    this.cm = new CMEditorView({
      state: CMEditorState.create({
        extensions: [
          CMkeymap.of([
            ...CMdefaultKeymap,
            ...Object.entries(this.keymaps()).map(([key, run]) => ({
              key,
              run,
            })),
          ]),
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
    this.dom = this.cm.dom;
    this.render();
  }

  keymaps(): { [key: string]: CMCommand } {
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

  render(): boolean | void {
    const tr = this.downwardChanges();
    tr && this.cm.dispatch(tr);
  }

  downwardChanges() {
    const from = this.cm.state.doc.toString();
    const to = this.node.textContent;
    const steps: CMChangeSpec[] = [];

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
