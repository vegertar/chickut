import React from "react";
import ReactDOM from "react-dom";

import {
  ExtensionContextProvider,
  ExtensionState,
  useManager,
  ExtensionView,
} from "./hooks";

type Props = {
  dom: HTMLElement;
  children?: React.ReactNode;
};

export function Extension({ dom, children }: Props) {
  return ReactDOM.createPortal(children, dom);
}

type ExtensionProviderProps = { children: React.ReactNode } & Pick<
  ExtensionState,
  "extensionViews" | "extensionPacks" | "extensionVersions"
> &
  ReturnType<typeof useManager>;

const cachedViews: { [name: string]: ExtensionView } = {};

function provideExtension(
  child: React.ReactNode,
  {
    extensionViews,
    extensionPacks,
    extensionVersions,
    ...props
  }: Omit<ExtensionProviderProps, "children">
) {
  let extensionName: string | undefined;
  let extensionView: ExtensionView | undefined;
  let extensionVersion: number | undefined;

  if (React.isValidElement(child) && typeof child.type === "function") {
    extensionName = child.type.name.toLowerCase();
    extensionView = extensionViews[extensionName];
    extensionVersion = extensionVersions[extensionName];

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
      value={{
        ...props,
        extensionView,
        extensionName,
        extensionVersion,
      }}
    >
      {child}
    </ExtensionContextProvider>
  );
}

export function ExtensionProvider({
  children,
  ...props
}: ExtensionProviderProps) {
  return (
    <>
      {React.Children.map(children, (child) => provideExtension(child, props))}
    </>
  );
}

export default Extension;
