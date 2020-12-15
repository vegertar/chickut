import React from "react";
import ReactDOM from "react-dom";

import {
  useExtensionContext,
  ExtensionContextProvider,
  ExtensionContextProps,
  State,
  useManager,
} from "./hooks";

type Props = {
  id?: string;
  children?: React.ReactNode;
};

export default function Extension({ id, children }: Props) {
  const { extensionView } = useExtensionContext();
  if (!extensionView || !id) {
    return null;
  }

  const nodeView = extensionView.find((item) => item.id === id);
  if (!nodeView) {
    return null;
  }

  return ReactDOM.createPortal(children, nodeView.dom as HTMLElement);
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
