import React, { useState } from "react";
import { Portal } from "react-portal";

import { toDataAttrs, NodeExtension, useExtension } from "../../../editor";

import handle from "./handle";
import plugins from "./plugins";
import Panel from "./panel";
import Inspector from "./inspector";
import { useView } from "./view";
import { Script, useScript } from "./script";

import "./style.scss";

const extension: NodeExtension = {
  plugins,
  rule: { handle },
  node: {
    attrs: { info: { default: "" } },
    content: "text*",
    marks: "", // disallow marks
    group: "block",
    code: true,
    defining: true,
    draggable: false,
    parseDOM: [
      {
        tag: "pre",
        preserveWhitespace: "full",
        contentElement: "code",
        getAttrs: (node) => (node as HTMLElement).dataset,
      },
    ],
    toDOM: ({ attrs }) => ["pre", toDataAttrs(attrs), ["code", 0]],
  },
};

export default function Code() {
  const { name } = useExtension(extension, "code");
  const { nodeViews, focus } = useView(name);
  const [script, setScript] = useState<Script>();
  const results = useScript(nodeViews, script);

  return (
    <>
      {nodeViews.map((nodeView) => {
        const result = results[nodeView.id];
        return (
          <Portal key={nodeView.id} node={nodeView.dom}>
            {result && <Inspector {...result} />}
            {focus === nodeView.id && (
              <Panel
                onExecute={() =>
                  setScript({
                    id: focus,
                    code: nodeView.cm.state.doc.toString(),
                  })
                }
              />
            )}
          </Portal>
        );
      })}
    </>
  );
}
