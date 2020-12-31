import React from "react";

import { ExtensionContextProvider, useManager } from "./hooks";

type ExtensionProviderProps = { children: React.ReactNode } & ReturnType<
  typeof useManager
>;

export function ExtensionProvider({
  children,
  ...props
}: ExtensionProviderProps) {
  return (
    <>
      {React.Children.map(children, (child) => (
        <ExtensionContextProvider value={props}>
          {child}
        </ExtensionContextProvider>
      ))}
    </>
  );
}
