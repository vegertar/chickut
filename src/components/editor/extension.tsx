import React from "react";
import ReactDOM from "react-dom";

import {
  ExtensionContextProvider,
  ExtensionContextProps,
  State,
  useManager,
} from "./hooks";

type Props = {
  dom: HTMLElement;
  children?: React.ReactNode;
};

export default function Extension({ dom, children }: Props) {
  return ReactDOM.createPortal(children, dom);
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
