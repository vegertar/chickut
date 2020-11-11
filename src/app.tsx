import React, { useRef, useState } from "react";
import produce from "immer";

import Theme, { light, dark } from "./components/theme";
import Editor from "./components/editor";
import * as Extensions from "./components/extensions";

import "./app.css";

type Extension = {
  render: React.FC<any>;
  status?: "disabling" | "disabled" | "enabling" | "enabled";
  props?: Record<string, any>;
  child?: React.ReactNode;
};

export default function App() {
  const index = useRef(0);
  const [theme, setTheme] = useState(light);
  const [extensions, setExtensions] = useState<{
    [name: string]: Extension;
  }>(
    Object.entries(Extensions).reduce(
      (result, [name, render]) => ({
        ...result,
        [name.toLowerCase()]: {
          render,
        },
      }),
      {} as { [name: string]: Extension }
    )
  );

  return (
    <Theme className={`${theme} app`}>
      <div className="menu">
        <div>
          <button onClick={() => setTheme((x) => (x === light ? dark : light))}>
            switch theme
          </button>
        </div>
        <div className="extensions">
          {Object.entries(extensions).map(([name, value]) => (
            <button
              key={name}
              className={value.status}
              onClick={() => {
                setExtensions((extensions) =>
                  produce(extensions, (draft) => {
                    if (!value.status || value.status === "disabled") {
                      draft[name].status = "enabling";
                    } else if (value.status === "enabled") {
                      draft[name].status = "disabling";
                    }
                  })
                );
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <Editor
        ref={(ref) => {
          if (!ref) {
            return;
          }

          const view = ref.view;
          if (!view) {
            return;
          }

          const present = ref.events.slice(index.current);
          if (!present.length) {
            return;
          }

          index.current += present.length;
          setExtensions((extensions) =>
            produce(extensions, (draft) => {
              present.forEach(([event, name, error, data]) => {
                console.log(event, name, error, data);
                if (event === "load" && !error) {
                  draft[name].status = "enabled";
                } else if (event === "off-load" && !error) {
                  draft[name].status = "disabled";
                }
              });
            })
          );
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
