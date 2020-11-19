import {
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useReducer,
  createContext,
} from "react";
import { EditorView, Decoration, NodeView } from "prosemirror-view";
import { EditorState } from "prosemirror-state";
import { Node as ProsemirrorNode, DOMSerializer } from "prosemirror-model";
import produce from "immer";

import Manager, { Events } from "./manager";

type Extension = Events["load"];
type ExtensionView = Events["create-view"];

type ContextProps = Partial<ExtensionView> & {
  view?: EditorView;
  dispatch?: React.Dispatch<Action>;
};

const Context = createContext<ContextProps>({});

export const ExtensionContextProvider = Context.Provider;

export interface State {
  extensions: Record<string, Extension>;
  extensionViews: Record<string, ExtensionView>;
}

interface Action extends Partial<Events> {
  target: string;
}

function reducer(state: State, action: Action) {
  const target = action.target;

  if (action.load) {
    const data = action.load;
    return produce(state, (draft) => {
      draft.extensions[target] = data;
    });
  }

  if (action["off-load"]) {
    return produce(state, (draft) => {
      delete draft.extensions[target];
    });
  }

  if (action["create-view"]) {
    const data = action["create-view"];
    return produce(state, (draft: State) => {
      draft.extensionViews[target] = data;
    });
  }

  if (action["update-view"]) {
    const data = action["update-view"];
    return produce(state, (draft) => {
      const old = draft.extensionViews[target];
      draft.extensionViews[target] = { ...old, ...data };
    });
  }

  if (action["destroy-view"]) {
    return produce(state, (draft) => {
      delete draft.extensionViews[target];
    });
  }

  return state;
}

export function useManager(element: HTMLDivElement | null) {
  const [view, setView] = useState<EditorView>();
  const [{ extensions, extensionViews }, dispatch] = useReducer(reducer, {
    extensions: {},
    extensionViews: {},
  });

  const createNodeView = useCallback((name: string) => {
    return (
      node: ProsemirrorNode,
      view: EditorView,
      getPos: boolean | (() => number),
      decorations: Decoration[]
    ) => {
      let dom: Node | undefined;
      let contentDOM: Node | null | undefined;

      const spec = node.type.spec.toDOM?.(node);
      if (spec) {
        ({ dom, contentDOM } = DOMSerializer.renderSpec(document, spec));
      }
      if (!dom || dom === contentDOM) {
        return (null as unknown) as NodeView;
      }

      dispatch({
        target: name,
        "create-view": {
          dom,
          node,
          getPos,
          decorations,
        },
      });

      return {
        dom,
        contentDOM,
        update: (node: ProsemirrorNode, decorations: Decoration[]) => {
          dispatch({
            target: name,
            "update-view": { node, decorations },
          });
          return true;
        },
        selectNode: () => {
          console.log("selected\n");
        },
        destroy: () => {
          dispatch({
            target: name,
            "destroy-view": {},
          });
        },
      } as NodeView;
    };
  }, []);

  useEffect(
    function destroyView() {
      return () => {
        view?.destroy();
      };
    },
    [view]
  );

  useEffect(
    function createView() {
      if (!element) {
        return;
      }

      const config = new Manager(extensions).createConfig();
      if (!config) {
        return;
      }

      // TODO: transfer history
      const state = EditorState.create(config);
      const nodeViews = Object.keys(extensions).reduce(
        (all, name) => ({
          ...all,
          [name]: createNodeView(name),
        }),
        {} as Record<string, ReturnType<typeof createNodeView>>
      );

      const view = new EditorView(element, { state, nodeViews });
      setView(view);
    },
    [extensions, element, createNodeView]
  );

  return { view, dispatch, extensionViews };
}

export function useExtensionContext() {
  return useContext(Context);
}

export function useExtension(extension: Extension) {
  const context = useExtensionContext();
  const dispatch = context.dispatch;

  useEffect(() => {
    const name = extension.name.toLowerCase();
    dispatch?.({ target: name, load: extension });

    return () => {
      dispatch?.({ target: name, "off-load": {} });
    };
  }, [dispatch, extension]);

  return context;
}
