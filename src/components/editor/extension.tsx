import React from "react";
import ReactDOM from "react-dom";

import { useExtensionContext, ExtensionContextProvider, State } from "./hooks";

type Props = {
  children?: React.ReactNode;
};

export default function Extension({ children }: Props) {
  const { dom } = useExtensionContext();
  return dom ? ReactDOM.createPortal(children, dom as HTMLElement) : null;
}

type ExtensionProviderProps = { children: React.ReactNode } & Pick<
  State,
  "extensionViews"
> &
  ReturnType<typeof useExtensionContext>;

type ExtensionView = ExtensionProviderProps["extensionViews"][string];

export function ExtensionProvider({
  extensionViews,
  children,
  ...context
}: ExtensionProviderProps) {
  return (
    <>
      {React.Children.map(children, (child) => {
        let view: ExtensionView | undefined;
        if (React.isValidElement(child) && typeof child.type === "function") {
          view = extensionViews[child.type.name.toLowerCase()];
        }

        return (
          <ExtensionContextProvider value={{ ...context, ...view }}>
            {child}
          </ExtensionContextProvider>
        );
      })}
    </>
  );
}
