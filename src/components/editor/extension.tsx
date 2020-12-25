import React from "react";

import {
  ExtensionContextProvider,
  ExtensionState,
  useManager,
  ExtensionView,
} from "./hooks";

type ExtensionProviderProps = { children: React.ReactNode } & Pick<
  ExtensionState,
  "views" | "packs" | "versions"
> &
  ReturnType<typeof useManager>;

const cachedViews: { [name: string]: ExtensionView } = {};

function provideExtension(
  child: React.ReactNode,
  { views, packs, versions, ...props }: Omit<ExtensionProviderProps, "children">
) {
  let name: string | undefined;
  let view: ExtensionView | undefined;
  let version: number | undefined;

  if (React.isValidElement(child) && typeof child.type === "function") {
    name = child.type.name.toLowerCase();
    view = views[name];
    version = versions[name];

    const pack = packs[name];
    if (pack?.length) {
      let updated = false;
      for (const item of pack) {
        const itemView = views[item];
        if (!itemView?.length) {
          updated = true;
          delete cachedViews[item];
          continue;
        }
        if (itemView !== cachedViews[item]) {
          cachedViews[item] = itemView;
          updated = true;
        }

        if (!view) {
          view = [];
        }
        view.push(...itemView);
      }

      if (!view) {
        delete cachedViews[name];
      } else if (updated) {
        cachedViews[name] = view;
      } else {
        view = cachedViews[name];
      }
    }
  }

  return (
    <ExtensionContextProvider
      value={{
        ...props,
        view,
        name,
        version,
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
