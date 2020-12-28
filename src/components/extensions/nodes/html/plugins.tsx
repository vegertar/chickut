import React, { useEffect } from "react";
import { Node as ProsemirrorNode, NodeType } from "prosemirror-model";
import { Decoration, EditorView } from "prosemirror-view";
import { createState, useState } from "@hookstate/core";

import { ExtensionPlugin } from "../../../editor";

const scriptState = createState(0);

function setView(dom: HTMLElement, source: string) {
  const view = dom.querySelector(".view")!;
  view.innerHTML = source;
  if (view.querySelector("script")) {
    scriptState.set((x) => x + 1);
  }
}

class HtmlPlugin extends ExtensionPlugin {
  createNode = (node: ProsemirrorNode) => {
    const nodes = ExtensionPlugin.createTemplateNode(node)!;
    setView(nodes.dom as HTMLElement, node.textContent);
    return nodes;
  };

  updateNode = (
    node: ProsemirrorNode,
    decorations: Decoration[],
    doms: { dom?: Node | null }
  ) => {
    if (node.type !== this.type) {
      return false;
    }

    setView(doms.dom as HTMLElement, node.textContent);
    return true;
  };
}

export const Template = ({ name }: { name: string }) => (
  <ExtensionPlugin.Template name={name}>
    {
      /*html*/ `
    <div class=${name}>
      <pre><code spellCheck="false"></code></pre>
      <div class="view" contentEditable="false"></div>
    </div>
    `
    }
  </ExtensionPlugin.Template>
);

function useScript(name?: string) {
  const { value: version } = useState(scriptState);

  useEffect(() => {
    const scripts = document.querySelectorAll(`.${name} > .view script`);
    console.log(scripts);
  }, [version, name]);
}

export function useTemplate({
  view,
  name,
}: {
  view?: EditorView;
  name?: string;
}) {
  useScript(name);

  return name ? <Template name={name} /> : null;
}

export default function plugins(type: NodeType) {
  return [new HtmlPlugin(type)];
}
