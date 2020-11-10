import React, { useRef, useState } from "react";
import produce from "immer";
import { EditorView } from "prosemirror-view";

import Theme, { light, dark } from "./components/theme";
import {
  ExtensionContext,
  Doc,
  Text,
  Strong,
  Paragraph,
} from "./components/extensions";
import Editor from "./components/editor";

import "./app.css";

type Extension = {
  render: React.FC<any>;
  active?: boolean;
  props?: Record<string, any>;
  child?: React.ReactNode;
};

export default function App() {
  const view = useRef<EditorView>();
  const [theme, setTheme] = useState(light);
  const [extensions, setExtensions] = useState<{
    [name: string]: Extension;
  }>({
    doc: { render: Doc },
    text: {
      render: Text,
      child: `This is example content.`,
    },
    strong: { render: Strong },
    paragraph: { render: Paragraph },
  });

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
              className={value.active ? "active" : "inactive"}
              onClick={() => {
                setExtensions((extensions) =>
                  produce(extensions, (draft) => {
                    draft[name].active = !draft[name].active;
                  })
                );
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <Editor ref={view}>
        <ExtensionContext.Provider value={{ view: view.current }}>
          {Object.entries(extensions).map(
            ([name, { render: Render, active, props, child }]) =>
              active ? (
                <Render key={name} {...props}>
                  {child}
                </Render>
              ) : null
          )}
        </ExtensionContext.Provider>
      </Editor>
    </Theme>
  );
}
