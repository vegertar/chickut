import React from "react";

import Theme from "./components/theme";
import Editor from "./components/editor";
import Strong from "./components/extensions/marks/strong";

export default function App() {
  return (
    <Theme>
      <Editor>
        <Strong />
      </Editor>
    </Theme>
  );
}
