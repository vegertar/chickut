import React from "react";
import { Portal } from "react-portal";

import { toDataAttrs, NodeExtension, useExtension } from "../../../editor";

import handle from "./handle";
import plugins from "./plugins";
import Panel from "./panel";
import Inspector from "./inspector";
import { useView } from "./view";
import { useScript } from "./script";

import "./style.scss";

const extension: NodeExtension = {
  // plugins,
  rule: { handle },
  node: {
    attrs: { info: { default: "" } },
    content: "text*",
    group: "block",
    code: true,
    defining: true,
    draggable: false,
    parseDOM: [
      {
        tag: "pre.code",
        preserveWhitespace: "full",
        getAttrs: (node) => (node as HTMLElement).dataset,
      },
    ],
    toDOM: ({ attrs }) => [
      "pre",
      { ...toDataAttrs(attrs), class: "code" },
      ["code", 0],
    ],
  },
};

export default function Code() {
  const { name } = useExtension(extension, "code");
  const { nodeViews } = useView(name);
  const script = useScript(nodeViews);

  return (
    <>
      {nodeViews.map((nodeView) => {
        const { id, dom, cm } = nodeView;
        const state = script.get(id);

        return (
          <Portal key={id} node={dom}>
            <Panel
              isToggleOn={state !== undefined}
              onToggle={(isToggleOn) => {
                if (isToggleOn) {
                  const code = cm.state.doc.toString();
                  script.activate(code, id);
                } else {
                  script.deactivate(id);
                }
              }}
              onRefresh={() => script.activate(cm.state.doc.toString(), id)}
            />
            {state && <Inspector {...state} />}
          </Portal>
        );
      })}
    </>
  );
}
