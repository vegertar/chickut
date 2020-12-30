import { useEffect } from "react";
import { Node as ProsemirrorNode } from "prosemirror-model";
import { EditorView } from "prosemirror-view";
import { createState, useState } from "@hookstate/core";

import { DiffDOM } from "diff-dom";
import morphdom from "morphdom";

import { ExtensionPlugin } from "../../../editor";
import { Snippet } from "./runtime";

const dd = new DiffDOM();
const scriptState = createState(0);

export class NodeView {
  readonly dom: HTMLElement;
  readonly contentDOM?: Node | null;

  constructor(public readonly node: ProsemirrorNode) {
    const { dom, contentDOM } = ExtensionPlugin.createDefaultNode(node)!;
    this.dom = dom as HTMLElement;
    this.contentDOM = contentDOM;
    this.setView(node);
  }

  update(node: ProsemirrorNode) {
    if (node.type !== this.node.type) {
      return false;
    }

    this.setView(node);
    return true;
  }

  private setView(node: ProsemirrorNode) {
    const from = this.dom.querySelector(".view")!;
    const to = from.cloneNode() as HTMLElement;
    to.innerHTML = node.textContent;

    console.log(dd.diff(from, to));

    // morphdom(from, to, {
    //   onElUpdated(node) {
    //     console.log(node);
    //   },
    // });

    from.innerHTML = node.textContent;
    if (from.querySelector("script")) {
      scriptState.set((x) => x + 1);
    }
  }
}

function useScript(name?: string) {
  const state = useState(scriptState);

  useEffect(() => {
    document
      .querySelectorAll<HTMLScriptElement>(`div.${name}>div.view script`)
      .forEach((script) => {
        if (!script.textContent) {
          return;
        }

        const { vars, refs } = new Snippet(script.textContent);
        console.log({ vars, refs });
      });
  }, [state.value, name]);
}

export function useView({ view, name }: { view?: EditorView; name?: string }) {
  useScript(name);

  return null;
}
