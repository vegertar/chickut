import React, { createContext, useContext } from "react";
import ReactDOM from "react-dom";
import { EditorView, Decoration } from "prosemirror-view";
import { Node as ProsemirrorNode } from "prosemirror-model";

import { EventHandler } from "./manager";

export type ExtensionView = {
  dom?: Node;
  node?: ProsemirrorNode;
  getPos?: boolean | (() => number);
  decorations?: Decoration[];
};

type ContextProps = ExtensionView & {
  view?: EditorView;
  dispatch?: EventHandler;
};

export const ExtensionContext = createContext<ContextProps>({});

type Props = {
  children?: React.ReactNode;
};

export default function Extension({ children }: Props) {
  const { dom } = useContext(ExtensionContext);
  return dom ? ReactDOM.createPortal(children, dom as HTMLElement) : null;
}

type ExtensionProviderProps = Props &
  ContextProps & {
    extensionViews: Record<string, ExtensionView>;
  };

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
          <ExtensionContext.Provider value={{ ...context, ...view }}>
            {child}
          </ExtensionContext.Provider>
        );
      })}
    </>
  );
}
