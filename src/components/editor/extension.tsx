import React, { useCallback, useEffect } from "react";
import ReactDOM from "react-dom";

import {
  useExtensionContext,
  ExtensionContextProvider,
  ExtensionContextProps,
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

function provideExtension(
  child: React.ReactNode,
  extensionViews: Record<string, ExtensionView>,
  props?: ExtensionContextProps
) {
  let extensionName: string | undefined;
  let extensionView: ExtensionView | undefined;
  if (React.isValidElement(child) && typeof child.type === "function") {
    extensionName = child.type.name.toLowerCase();
    extensionView = extensionViews[extensionName];
  }

  return (
    <ExtensionContextProvider
      value={{ ...props, extensionView, extensionName }}
    >
      {child}
    </ExtensionContextProvider>
  );
}

export function ExtensionProvider({
  extensionViews,
  children,
  view: editorView,
  ...context
}: ExtensionProviderProps) {
  const props = { ...context, editorView };

  return (
    <>
      {React.Children.map(children, (child) =>
        provideExtension(child, extensionViews, props)
      )}
    </>
  );
}
