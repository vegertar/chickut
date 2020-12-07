import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
  useReducer,
  createContext,
} from "react";
import { EditorView, Decoration, NodeView } from "prosemirror-view";
import {
  DOMSerializer,
  Node as ProsemirrorNode,
  Schema,
} from "prosemirror-model";
import produce from "immer";

import Manager, { Events, MissingContentError } from "./manager";

type Extension = Events["load"];
type ExtensionView = Events["create-view"];

export type ExtensionContextProps = {
  editorView?: EditorView<Schema>;
  extensionView?: ExtensionView;
  extensionName?: string;
  dispatch?: React.Dispatch<Action>;
};

const ExtensionContext = createContext<ExtensionContextProps>({});

export const ExtensionContextProvider = ExtensionContext.Provider;

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
    if (state.extensions[target] !== undefined) {
      throw new Error(`extension ${target} is existed`);
    }

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

function ExtensionContentWrapper({
  contentWrapper,
  contentDOM,
}: {
  contentWrapper: HTMLElement;
  contentDOM: Node;
}) {
  const ref = useCallback(
    (wrapper: HTMLElement | null) => {
      if (!wrapper) {
        return;
      }

      wrapper.appendChild(contentDOM);
      const display = contentWrapper.style.display;
      contentWrapper.style.display = "none";

      return () => {
        contentWrapper.appendChild(contentDOM);
        contentWrapper.style.display = display;
      };
    },

    [contentWrapper, contentDOM]
  );

  return <span ref={ref} className="extension-content-wrapper" />;
}

function createDOM(node: ProsemirrorNode) {
  return node.isInline
    ? document.createElement("span")
    : document.createElement("div");
}

function createNodeViewDOMs(name: string, node: ProsemirrorNode) {
  if (node.isText) {
    return;
  }

  const spec = node.type.spec.toDOM?.(node);
  const renderer = spec ? DOMSerializer.renderSpec(document, spec) : null;

  const contentWrapper = renderer?.contentDOM || document.createElement("span");
  if (contentWrapper.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  let dom = renderer?.dom;
  if (dom === renderer?.contentDOM || !dom) {
    dom = createDOM(node);
  }

  const contentDOM = document.createElement("span");

  contentWrapper.appendChild(contentDOM);
  dom.appendChild(contentWrapper);
  (dom as HTMLElement).classList.add(`${name}-view`);
  (contentWrapper as HTMLElement).classList.add(`${name}-content-wrapper`);
  contentDOM.classList.add(`${name}-content`);

  return {
    dom,
    contentDOM,
    content: (
      <ExtensionContentWrapper
        contentWrapper={contentWrapper as HTMLElement}
        contentDOM={contentDOM}
      />
    ),
  };
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
      const doms = createNodeViewDOMs(name, node);
      if (!doms) {
        return (null as any) as NodeView;
      }

      const { dom, contentDOM, content } = doms;

      dispatch({
        target: name,
        "create-view": {
          dom,
          node,
          content,
          getPos,
          decorations,
        },
      });

      const extensionNode = node;
      return {
        dom,
        contentDOM,
        update: (node: ProsemirrorNode, decorations: Decoration[]) => {
          // extension type got changed
          if (node.type !== extensionNode.type) {
            return false;
          }

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

      let manager: Manager;

      try {
        manager = new Manager(extensions);
      } catch (e) {
        if (e instanceof MissingContentError) {
          console.warn(e);
          return;
        }
        throw e;
      }

      const config = manager.createConfig();
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
    [extensions, createNodeView, element]
  );

  return { view, dispatch, extensionViews };
}

export function useExtensionContext() {
  const { dispatch, extensionName, ...context } = useContext(ExtensionContext);
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
