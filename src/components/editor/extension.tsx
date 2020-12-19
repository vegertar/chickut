import React from "react";
import ReactDOM from "react-dom";

import {
  ExtensionContextProvider,
  ExtensionContextProps,
  State,
  useManager,
  ExtensionView,
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

const cachedViews: { [name: string]: ExtensionView } = {};

function provideExtension(
  child: React.ReactNode,
  extensionViews: ExtensionViews,
  extensionPacks: ExtensionPacks,
  props?: ExtensionContextProps
) {
  let extensionName: string | undefined;
  let extensionView: ExtensionView | undefined;

  if (React.isValidElement(child) && typeof child.type === "function") {
    extensionName = child.type.name.toLowerCase();
    extensionView = extensionViews[extensionName];

    const extensionPack = extensionPacks[extensionName];
    if (extensionPack?.length) {
      let updated = false;
      for (const name of extensionPack) {
        const view = extensionViews[name];
        if (!view?.length) {
          updated = true;
          delete cachedViews[name];
          continue;
        }
        if (!extensionView) {
          extensionView = [];
        }
        if (view !== cachedViews[name]) {
          cachedViews[name] = view;
          updated = true;
        }
        extensionView.push(...view);
      }

      if (!extensionView) {
        delete cachedViews[extensionName];
      } else if (updated) {
        cachedViews[extensionName] = extensionView;
      } else {
        extensionView = cachedViews[extensionName];
      }
    }
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
