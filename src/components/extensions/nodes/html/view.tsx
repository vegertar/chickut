import React, { useEffect, useState } from "react";
import { Node as ProsemirrorNode } from "prosemirror-model";
import { EditorView } from "prosemirror-view";
import { DiffDOM } from "diff-dom";

import { ExtensionPlugin } from "../../../editor";
import Runtime from "./runtime";

const dd = new DiffDOM();

var updateVersion: (() => void) | undefined;

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
      updateVersion?.();
    }
  }
}

function useScript(name?: string) {
  const [version, setVersion] = useState(0);
  const [testingData, setTestingData] = useState<string>();

  useEffect(() => {
    updateVersion = () => setVersion((x) => x + 1);
    return () => (updateVersion = undefined);
  }, []);

  useEffect(() => {
    const codes: string[] = [];
    document
      .querySelectorAll<HTMLScriptElement>(`div.${name}>div.view script`)
      .forEach((script) => {
        if (script.textContent) {
          codes.push(script.textContent);
        }
      });

    const runtime = new Runtime(codes, {
      onReturned: (closure) => {
        if (closure.result) {
          setTestingData(closure.result);
        }
      },
    });
    runtime.evaluate();
    return () => runtime.dispose();
  }, [version, name]);

  return testingData ? <span>{testingData}</span> : null;
}

export function useView({ view, name }: { view?: EditorView; name?: string }) {
  return useScript(name);
}
