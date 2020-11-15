import { createContext, useContext, useEffect, useRef } from "react";
import { EditorView } from "prosemirror-view";
import { Plugin } from "prosemirror-state";
import { NodeType, MarkType, NodeSpec, MarkSpec } from "prosemirror-model";

type Plugins = Plugin[] | ((type: NodeType | MarkType) => Plugin[]);

type Base = {
  name: string;
};

export type NodeExtension = Base & {
  node: NodeSpec;
};

export type MarkExtension = Base & {
  mark: MarkSpec;
};

export type PluginExtension = Base & {
  plugins: Plugins;
};

export type Extension = NodeExtension | MarkExtension | PluginExtension;

export interface Events {
  load: {
    id: string;
    extension: Extension;
  };
  ["off-load"]: string;
}

export interface EventHandler {
  <T extends keyof Events>(event: T, target: string, data: Events[T]): void;
}

type ContextProps = {
  view?: EditorView;
  dispatch?: EventHandler;
};

export const Context = createContext<ContextProps>({});

var counter = 0;

export function useExtension(extension: Extension) {
  const seq = useRef(++counter);
  const { dispatch } = useContext(Context);

  useEffect(() => {
    const id = seq.current.toString();
    const name = extension.name.toLowerCase();
    dispatch?.("load", name, {
      id,
      extension,
    });

    return () => {
      dispatch?.("off-load", name, id);
    };
  }, [dispatch, extension]);

  return null;
}
