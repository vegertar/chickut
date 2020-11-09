import React, { useState } from "react";

import Theme, { light, dark } from "./components/theme";
import Editor from "./components/editor";
import { Doc, Text, Strong, Paragraph } from "./components/extensions";

export default function App() {
  const [theme, setTheme] = useState(light);

  return (
    <Theme name={theme}>
      <br />
      <button
        onClick={() => {
          setTheme((x) => (x === light ? dark : light));
        }}
      >
        switch theme
      </button>
      <br />
      <br />
      <Editor autoFocus>
        {`
#Welcome

This is example content. It is persisted between reloads in localStorage.
`}

        <Doc />
        <Text />
        <Paragraph />
        <Strong />
      </Editor>
    </Theme>
  );
}
