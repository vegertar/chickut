import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import produce from "immer";
import { EditorView } from "prosemirror-view";

import Theme, { light, dark } from "./components/theme";
import Editor from "./components/editor";
import { useTreeView } from "./components/extensions/manager";
import * as Extensions from "./components/extensions";

import "./app.scss";

type Extension = {
  render: React.FC<any>;
  status?: "disabling" | "disabled" | "enabling" | "enabled";
  props?: Record<string, any>;
  child?: React.ReactNode;
};

export default function App() {
  const index = useRef(0);
  const treeView = useTreeView(Extensions);
  const [theme, setTheme] = useState(light);
  const [devTools, setDevTools] = useState<{ view?: EditorView }>({});
  const [extensions, setExtensions] = useState(
    Object.entries(Extensions).reduce(
      (result, [name, render]) => ({
        ...result,
        [name.toLowerCase()]: {
          render,
        },
      }),
      {} as Record<string, Extension>
    )
  );

  useEffect(() => {
    document.querySelectorAll("[data-is-extension]>span").forEach((element) => {
      const name = element.parentElement?.getAttribute("data-is-extension");
      name &&
        element.addEventListener("click", () => {
          setExtensions((extensions) =>
            produce(extensions, (draft) => {
              const value = extensions[name];
              if (!value.status || value.status === "disabled") {
                draft[name].status = "enabling";
              } else if (value.status === "enabled") {
                draft[name].status = "disabling";
              } else if (value.status === "enabling") {
                draft[name].status = undefined;
              }

              element.className = draft[name].status || "";
            })
          );
        });
    });
  }, [treeView]);

  useEffect(() => {
    Object.entries(extensions).forEach(([name, extension]) => {
      const element = document.querySelector(
        `[data-is-extension=${name}]>span`
      );
      if (!element) {
        return;
      }

      element.className = extension.status || "";
    });
  }, [extensions]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && devTools.view) {
      if (typeof Window !== "undefined") {
        (Window as any).view = devTools.view;
      }
      require("prosemirror-dev-tools").applyDevTools(devTools.view);
      return () => {
        const node = document.querySelector(".__prosemirror-dev-tools__");
        if (node) {
          ReactDOM.unmountComponentAtNode(node);
          node.remove();
        }
      };
    }
  }, [devTools]);

  return (
    <Theme className={`${theme} app`}>
      <div className="menu">
        <div>
          <button onClick={() => setTheme((x) => (x === light ? dark : light))}>
            switch theme
          </button>
        </div>
        {treeView}
      </div>

      <Editor
        ref={(ref) => {
          if (!ref || !ref.view) {
            return;
          }

          const view = ref.view;
          if (process.env.NODE_ENV !== "production") {
            setDevTools((devTools) =>
              devTools.view !== view ? { view } : devTools
            );
          }

          const present = ref.events.slice(index.current);
          if (!present.length) {
            return;
          }

          index.current += present.length;
          let reloaded = false;

          setExtensions((extensions) =>
            produce(extensions, (draft) => {
              present.forEach(([event, name, error, data]) => {
                console.log(event, name, error, data);
                if (event === "load" && !error) {
                  reloaded = true;
                  draft[name].status = "enabled";
                } else if (event === "off-load" && !error) {
                  reloaded = true;
                  draft[name].status = "disabled";
                }
              });
            })
          );

          if (reloaded && process.env.NODE_ENV !== "production") {
            setDevTools({ view });
          }
        }}
      >
        {Object.entries(extensions).map(
          ([name, { render: Render, status, props, child }]) =>
            status === "enabling" || status === "enabled" ? (
              <Render key={name} {...props}>
                {child}
              </Render>
            ) : null
        )}
      </Editor>
    </Theme>
  );
}
