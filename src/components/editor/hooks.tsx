import {
  useContext,
  useEffect,
  useState,
  useCallback,
  useReducer,
  createContext,
} from "react";
import { EditorView, Decoration, NodeView } from "prosemirror-view";
import { EditorState } from "prosemirror-state";
import {
  Node as ProsemirrorNode,
  DOMSerializer,
  Schema,
} from "prosemirror-model";
import produce from "immer";

import { createConfig, Events } from "./manager";

type Extension = Events["load"];
type ExtensionView = Events["create-view"];

type ContextProps = {
  editorView?: EditorView<Schema>;
  extensionView?: ExtensionView;
  extensionName?: string;
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

function createDOM(node: ProsemirrorNode) {
  const element: HTMLElement = node.isInline
    ? document.createElement("span")
    : document.createElement("div");

  // Prosemirror breaks down when it encounters multiple nested empty
  // elements. This class prevents this from happening.
  element.classList.add(`node-view-wrapper`);

  return element;
}

function createContentDOM(node: ProsemirrorNode) {
  if (node.isLeaf) {
    return;
  }

  const domSpec = node.type.spec.toDOM?.(node);

  // Only allow content if a domSpec exists which is used to render the content.
  if (!domSpec) {
    return;
  }

  // Let `ProseMirror` interpret the domSpec returned by `toDOM` to provide
  // the dom and `contentDOM`.
  const { contentDOM, dom } = DOMSerializer.renderSpec(document, domSpec);

  // The content dom needs a wrapper node in react since the dom element which
  // it renders inside isn't immediately mounted.
  let wrapper: HTMLElement;

  if (dom.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  // Default to setting the wrapper to a different element.
  wrapper = dom as HTMLElement;

  if (dom === contentDOM) {
    wrapper = document.createElement("span");
    wrapper.classList.add(`node-view-content-wrapper`);
    wrapper.append(contentDOM);
  }

  return { wrapper, contentDOM };
}

export function useManager(element: HTMLDivElement | null, autoFix = false) {
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
      // TODO: Copies the attributes from a ProseMirror Node to the parent DOM node.

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

      const config = createConfig(extensions, autoFix);
      if (!config) {
        return;
      }

      const nodeViews = Object.keys(extensions).reduce(
        (all, name) => ({
          ...all,
          [name]: createNodeView(name),
        }),
        {} as Record<string, ReturnType<typeof createNodeView>>
      );

      const view = new EditorView(element, {
        ...config,
        nodeViews,
        dispatchTransaction(tr) {
          console.log(
            "Document size went from",
            tr.before.content.size,
            "to",
            tr.doc.content.size
          );
          const newState = view.state.apply(tr);
          view.updateState(newState);
        },
      });
      setView(view);
    },
    [extensions, createNodeView, element, autoFix]
  );

  return { view, dispatch, extensionViews };
}

export function useExtensionContext() {
  const { dispatch, extensionName, ...context } = useContext(Context);
  const extensionDispatch = useCallback(
    (events: Partial<Events>) => {
      extensionName && dispatch?.({ target: extensionName, ...events });
    },
    [extensionName, dispatch]
  );

  return { ...context, dispatch: extensionDispatch, extensionName };
}

export function useExtension(extension: Extension) {
  const context = useExtensionContext();
  const dispatch = context.dispatch;

  useEffect(
    function setupExtension() {
      dispatch({ load: extension });
      return () => dispatch({ "off-load": {} });
    },
    [dispatch, extension]
  );

  return context;
}
