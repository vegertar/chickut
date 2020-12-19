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
  "extensionViews" | "extensionPacks"
> &
  ReturnType<typeof useManager>;

type ExtensionViews = ExtensionProviderProps["extensionViews"];
type ExtensionPacks = ExtensionProviderProps["extensionPacks"];

function provideExtension(
  child: React.ReactNode,
  extensionViews: ExtensionViews,
  extensionPacks: ExtensionPacks,
  props?: ExtensionContextProps
) {
  let extensionName: string | undefined;
  let extensionView: ExtensionViews["string"] | undefined;
  if (React.isValidElement(child) && typeof child.type === "function") {
    extensionName = child.type.name.toLowerCase();
    extensionView = extensionViews[extensionName];
    extensionPacks[extensionName]?.forEach((name) => {
      const view = extensionViews[name];
      if (!view?.length) {
        return;
      }
      if (!extensionView) {
        extensionView = [];
      }
      extensionView.push(...view);
    });
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
  extensionPacks,
  children,
  view: editorView,
  ...context
}: ExtensionProviderProps) {
  const props = { ...context, editorView };
  return (
    <>
      {React.Children.map(children, (child) =>
        provideExtension(child, extensionViews, extensionPacks, props)
      )}
    </>
  );
}
