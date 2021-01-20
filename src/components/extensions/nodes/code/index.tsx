import React, { useEffect } from "react";
import { Portal } from "react-portal";

import { toDataAttrs, NodeExtension, useExtension } from "../../../editor";

import handle from "./handle";
import plugins from "./plugins";
import Panel from "./panel";
import Inspector from "./inspector";
import { useView } from "./view";
import { useRuntime } from "./runtime";

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
  const { created, destroyed } = useView(name);
  const [{ status, results }, dispatch] = useRuntime();

  useEffect(() => {
    destroyed && dispatch({ delete: destroyed.id });
  }, [destroyed, dispatch]);

  return (
    <>
      {created.map((nodeView) => {
        const id = nodeView.id;
        const result = results[id];

        return (
          <Portal key={id} node={nodeView.dom}>
            <Panel
              isToggleOn={status[id] !== undefined}
              onToggle={(isToggleOn) => {
                if (isToggleOn) {
                  const code = nodeView.cm.state.doc.toString();
                  dispatch({ add: { code, id } });
                } else {
                  dispatch({ delete: id });
                }
              }}
              onRefresh={() =>
                dispatch({
                  add: {
                    code: nodeView.cm.state.doc.toString(),
                    id,
                  },
                })
              }
            />
            {result && <Inspector {...result} />}
          </Portal>
        );
      })}
    </>
  );
}
