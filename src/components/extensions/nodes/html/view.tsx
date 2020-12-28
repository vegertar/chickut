import { useEffect } from "react";
import { Node as ProsemirrorNode } from "prosemirror-model";
import { EditorView } from "prosemirror-view";
import { createState, useState } from "@hookstate/core";

import { ExtensionPlugin } from "../../../editor";

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
    const view = this.dom.querySelector(".view")!;
    view.innerHTML = node.textContent;
    if (view.querySelector("script")) {
      scriptState.set((x) => x + 1);
    }
  }
}

function useScript(name?: string) {
  const state = useState(scriptState);

  useEffect(() => {
    const scripts = document.querySelectorAll(`.${name} > .view script`);
    console.log(scripts);
  }, [state.value, name]);
}

export function useView({ view, name }: { view?: EditorView; name?: string }) {
  useScript(name);

  return null;
}
