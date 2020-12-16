import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
  useReducer,
  createContext,
  useRef,
} from "react";
import {
  EditorView,
  Decoration,
  NodeView,
  DirectEditorProps,
} from "prosemirror-view";
import {
  DOMSerializer,
  Node as ProsemirrorNode,
  Schema,
} from "prosemirror-model";
import produce from "immer";
import remove from "lodash.remove";

import Manager, { Extension, MissingContentError, NodeSpec } from "./manager";

var seq = 0;

type ExtensionNodeView = {
  id: string;
  dom: Node;
  contentDOM: Node;
  content: React.ReactNode;
  node: ProsemirrorNode;
  getPos: boolean | (() => number);
  decorations: Decoration[];
};

type ExtensionView = ExtensionNodeView[];

interface Events {
  load: Extension;
  ["off-load"]: {};
  ["create-view"]: ExtensionNodeView;
  ["update-view"]: Pick<ExtensionNodeView, "id" | "node" | "decorations">;
  ["destroy-view"]: Pick<ExtensionNodeView, "id">;
}

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

// IMPORTANT: reducer should be a pure function, so Action should be a pure action as well
function reducer(state: State, action: Action) {
  const target = action.target;
  console.info(action);

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
      if (!draft.extensionViews[target]) {
        draft.extensionViews[target] = [];
      }
      draft.extensionViews[target].push(data);
    });
  }

  if (action["update-view"]) {
    const data = action["update-view"];
    return produce(state, (draft) => {
      const nodeViews = draft.extensionViews[target];
      for (let i = 0; i < nodeViews.length; ++i) {
        if (nodeViews[i].id === data.id) {
          nodeViews[i] = { ...nodeViews[i], ...data };
          break;
        }
      }
    });
  }

  if (action["destroy-view"]) {
    const data = action["destroy-view"];
    return produce(state, (draft) => {
      const nodeViews = draft.extensionViews[target];
      remove(nodeViews, (item) => item.id === data.id);
      if (nodeViews.length === 0) {
        delete draft.extensionViews[target];
      }
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
  const dom = node.isInline
    ? document.createElement("span")
    : document.createElement("div");
  return dom;
}

function createNodeViewDOMs(name: string, node: ProsemirrorNode) {
  if (node.isText) {
    return;
  }

  const spec = node.type.spec.toDOM?.(node);
  const renderer = spec ? DOMSerializer.renderSpec(document, spec) : null;

  const dom = createDOM(node);

  const contentWrapper = (renderer?.dom || createDOM(node)) as HTMLElement;
  if (contentWrapper.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  let contentDOM = renderer?.contentDOM as HTMLElement;
  if (contentDOM === contentWrapper || !contentDOM) {
    contentDOM = document.createElement("span");
  }
  if (contentDOM.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  contentWrapper.appendChild(contentDOM);
  dom.appendChild(contentWrapper);
  dom.classList.add(name, "extension-view");
  contentWrapper.classList.add(name, "extension-content-wrapper");
  contentDOM.classList.add(name, "extension-content");
  contentDOM.id = `id-${seq++}`;

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
  const viewRef = useRef<EditorView>();
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
      const id = contentDOM.id;

      dispatch({
        target: name,
        "create-view": {
          id,
          dom,
          contentDOM,
          content,
          node,
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
            "update-view": { id, node, decorations },
          });
          return true;
        },
        selectNode: () => {
          console.log("selected\n");
        },
        destroy: () => {
          dispatch({
            target: name,
            "destroy-view": { id },
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

      const props: DirectEditorProps = { ...config, nodeViews };
      if (viewRef.current) {
        viewRef.current.setProps(props);
      } else {
        const view = new EditorView(element, {
          ...props,
          dispatchTransaction(tr) {
            console.log(
              "Document went from",
              tr.before.content.toString(),
              "to",
              tr.doc.content.toString()
            );
            const newState = this.state.apply(tr);
            this.updateState(newState);
          },
        });
        viewRef.current = view;
        setView(view);
      }
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

function toText(node?: ProsemirrorNode) {
  return node && (node.type.spec as NodeSpec).toText?.(node);
}

function normalizeText(text?: string) {
  return text?.replace(/\r\n/g, "\n").replace(/\n/g, "\u2424");
}

export function useExtensionView(
  editorView?: EditorView,
  extensionView?: ExtensionView
) {
  const [nodeView, setNodeView] = useState<
    Partial<ExtensionNodeView> & Pick<ExtensionNodeView, "id">
  >();

  useEffect(() => {
    if (!editorView) {
      setNodeView(undefined);
      return;
    }

    const pos = editorView.state.selection.$from.start();
    const { node } = editorView.domAtPos(pos);
    if (extensionView) {
      for (const nodeView of extensionView) {
        if (nodeView.contentDOM === node) {
          setNodeView(nodeView);
          return;
        }
      }
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      setNodeView(undefined);
      return;
    }

    const contentDOM = node as HTMLElement;
    setNodeView(
      contentDOM.classList.contains("extension-content")
        ? { id: contentDOM.id }
        : undefined
    );
  }, [editorView, extensionView]);

  return nodeView;
}

export function useTextExtension(extension: Extension, text?: string) {
  const contentRef = useRef<string>();
  const { editorView, extensionView } = useExtension(extension);
  const { id, node, ...data } =
    useExtensionView(editorView, extensionView) || {};

  useEffect(() => {
    contentRef.current = toText(node);
  }, [node]);

  useEffect(() => {
    if (!id) {
      return;
    }
    const contentDOM = document.getElementById(id);
    if (!contentDOM) {
      return;
    }
    const content = normalizeText(text);
    if (content !== undefined && content !== contentRef.current) {
      contentDOM.textContent = content;
    }
  }, [text, id]);

  return { id, node, ...data };
}
