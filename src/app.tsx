import React, { useState } from "react";

import Theme, { light, dark } from "./components/theme";
import Editor from "./components/editor";
import * as Extensions from "./components/extensions";

import "./app.scss";

export default function App() {
  const [theme, setTheme] = useState(light);

  return (
    <Theme theme={theme} className="app">
      <div className="menu">
        <div>
          <button onClick={() => setTheme((x) => (x === light ? dark : light))}>
            switch theme
          </button>
        </div>
      </div>

      <Editor>
        {Object.entries(Extensions).map(([name, Render]) => (
          <Render key={name} />
        ))}
      </Editor>
    </Theme>
  );
}
