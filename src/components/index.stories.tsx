import React from "react";

import Theme from "./theme";
import Editor from "./editor";

type ThemeProps = {
  theme?: string;
};

type EditorProps = {
  autoFix?: boolean;
};

type ThemedEditorProps<P> = P & ThemeProps & EditorProps;

export function withThemedEditor<P = {}>(
  Component: React.FC<P>,
  addon?: React.ReactNode
) {
  return (props: ThemedEditorProps<P>) => (
    <Theme
      theme={props.theme}
      style={{
        margin: "0 auto",
        padding: "0 20px",
      }}
    >
      <Editor autoFix={props.autoFix === undefined ? true : props.autoFix}>
        <Component {...props} />
        {addon}
      </Editor>
    </Theme>
  );
}
