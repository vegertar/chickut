import React from "react";

import { ExtensionContextProvider, useManager } from "./hooks";

type ExtensionProviderProps = { children: React.ReactNode } & ReturnType<
  typeof useManager
>;

function provideExtension(
  child: React.ReactNode,
  { ...props }: Omit<ExtensionProviderProps, "children">
) {
  let name: string | undefined;

  if (React.isValidElement(child) && typeof child.type === "function") {
    name = child.type.name.toLowerCase();
  }

  return (
    <ExtensionContextProvider
      value={{
        ...props,
        name,
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
