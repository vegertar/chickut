import React from "react";
import ReactDOM from "react-dom";

import {
  useExtensionContext,
  ExtensionContextProvider,
  State,
  useManager,
} from "./hooks";

type Props = {
  children?: React.ReactNode;
};

export default function Extension({ children }: Props) {
  const { extensionView } = useExtensionContext();
  return extensionView
    ? ReactDOM.createPortal(children, extensionView.dom as HTMLElement)
    : null;
}

type ExtensionProviderProps = { children: React.ReactNode } & Pick<
  State,
  "extensionViews"
> &
  ReturnType<typeof useManager>;

type ExtensionView = ExtensionProviderProps["extensionViews"][string];

export function ExtensionProvider({
  extensionViews,
  children,
  view: editorView,
  ...context
}: ExtensionProviderProps) {
  return (
    <>
      {React.Children.map(children, (child) => {
        let extensionName: string | undefined;
        let extensionView: ExtensionView | undefined;
        if (React.isValidElement(child) && typeof child.type === "function") {
          extensionName = child.type.name.toLowerCase();
          extensionView = extensionViews[extensionName];
        }

        if (!extensionName) {
          return null;
        }

        return (
          <ExtensionContextProvider
            value={{ ...context, editorView, extensionView, extensionName }}
          >
            {child}
          </ExtensionContextProvider>
        );
      })}
    </>
  );
}
