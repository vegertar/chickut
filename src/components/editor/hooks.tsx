import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useReducer,
  useRef,
} from "react";
import { EditorView, Decoration, NodeView } from "prosemirror-view";
import { DOMSerializer, Node as ProsemirrorNode } from "prosemirror-model";
import produce from "immer";
import remove from "lodash.remove";

import Manager, {
  Extension,
  ExtensionPack,
  MissingContentError,
  NodeSpec,
  Schema,
} from "./manager";

var seq = 0;

type ContentView = {
  id: string;
  dom: HTMLElement;
  contentDOM: HTMLElement;
  content: React.ReactNode;
  node: ProsemirrorNode;
  getPos: boolean | (() => number);
  decorations: Decoration[];
};

type ExtensionView = ContentView[];

interface Events {
  load: Extension | ExtensionPack;
  ["off-load"]: Extension | ExtensionPack;
  ["create-view"]: ContentView;
  ["update-view"]: Pick<ContentView, "id" | "node" | "decorations">;
  ["destroy-view"]: Pick<ContentView, "id">;
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
  extensionPacks: Record<string, string[]>;
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
    return produce(state, (draft) => {
      if (Array.isArray(data)) {
        if (state.extensionPacks[target] !== undefined) {
          throw new Error(`extension pack ${target} is existed`);
        }
        const pack: string[] = [];
        for (const { name, ...extension } of data) {
          if (state.extensions[name] !== undefined) {
            throw new Error(`extension ${name} is existed`);
          }
          draft.extensions[name] = extension;
          pack.push(name);
        }
        draft.extensionPacks[target] = pack;
      } else {
        if (state.extensions[target] !== undefined) {
          throw new Error(`extension ${target} is existed`);
        }
        draft.extensions[target] = data;
      }
    });
  }

  if (action["off-load"]) {
    const data = action["off-load"];
    return produce(state, (draft) => {
      if (Array.isArray(data)) {
        for (const { name } of data) {
          delete draft.extensions[name];
        }
        delete draft.extensionPacks[target];
      } else {
        delete draft.extensions[target];
      }
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

function ExtensionContent({
  dom,
  contentDOM,
}: {
  dom: HTMLElement;
  contentDOM: HTMLElement;
}) {
  const contentWrapperRef = useRef<HTMLElement | null>(null);

  return (
    <span
      ref={useCallback(
        (content: HTMLElement | null) => {
          if (content) {
            const oldContentWrapper = contentDOM.parentElement;
            content.replaceWith(contentDOM);
            oldContentWrapper?.remove();
            contentWrapperRef.current = contentDOM.parentElement;
          } else if (contentWrapperRef.current) {
            const contentWrapper = contentWrapperRef.current.cloneNode();
            dom.appendChild(contentWrapper);
            contentWrapper.appendChild(contentDOM);
          }
        },
        [dom, contentDOM]
      )}
    />
  );
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
  };
}

export function useManager(element: HTMLDivElement | null) {
  const viewRef = useRef<EditorView>();
  const [view, setView] = useState<EditorView>();
  const [{ extensions, extensionViews, extensionPacks }, dispatch] = useReducer(
    reducer,
    {
      extensions: {},
      extensionViews: {},
      extensionPacks: {},
    }
  );

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

      const { dom, contentDOM } = doms;
      const id = contentDOM.id;
      const content = <ExtensionContent dom={dom} contentDOM={contentDOM} />;

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

      const props = { ...config, nodeViews };
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

  return { view, dispatch, extensionViews, extensionPacks };
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

export function useExtension(extension: Extension | ExtensionPack) {
  const context = useExtensionContext();
  const dispatch = context.dispatch;

  useEffect(
    function setupExtension() {
      dispatch({ load: extension });
      return () => dispatch({ "off-load": extension });
    },
    [dispatch, extension]
  );

  return context;
}

export function useContentView(
  editorView?: EditorView,
  extensionView?: ExtensionView
) {
  if (!editorView) {
    return;
  }

  let node: Node;

  try {
    // binding an event handler is not light, so handling directly without useEffect
    const pos = editorView.state.selection.$anchor.start();
    ({ node } = editorView.domAtPos(pos));
  } catch (e) {
    if (e instanceof Error && e.message.includes("Invalid position")) {
      return;
    }

    throw e;
  }

  if (extensionView) {
    for (const nodeView of extensionView) {
      if (nodeView.contentDOM === node) {
        return nodeView;
      }
    }
  }

  if (
    node instanceof HTMLElement &&
    node.classList.contains("extension-content")
  ) {
    return { id: node.id };
  }
}

function toText(node?: ProsemirrorNode) {
  return node && (node.type.spec as NodeSpec).toText?.(node);
}

function normalizeText(text?: string) {
  return text?.replace(/\r\n/g, "\n").replace(/\n/g, "\u2424");
}

function toContentView(data: ReturnType<typeof useContentView>) {
  const contentView = data as ContentView | undefined;
  return contentView?.dom && contentView;
}

export function useExtensionVersion(extensionView?: ExtensionView) {
  const [i, update] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    !extensionView && update();
  }, [extensionView]);

  return i;
}

export function useTextContent(
  context: ReturnType<typeof useExtension>,
  text?: string
) {
  const { editorView, extensionView } = context;
  const version = useExtensionVersion(extensionView);
  const contentView = useContentView(editorView, extensionView);
  const [textContent, setTextContent] = useState<string>();
  const idRef = useRef<string>();

  useEffect(() => {
    idRef.current = contentView?.id;
    const s = normalizeText(text);
    if (!contentView || s === undefined) {
      return;
    }

    if (s !== toText(toContentView(contentView)?.node)) {
      setTextContent(s);
    }
  }, [contentView, text]);

  useEffect(() => {
    const id = idRef.current;
    const contentDOM = id && document.getElementById(id);
    if (contentDOM && textContent !== undefined) {
      contentDOM.textContent = textContent;
    }
  }, [textContent, version]);

  return toContentView(contentView);
}

export function useTextExtension(
  extension: Extension | ExtensionPack,
  text?: string
) {
  return useTextContent(useExtension(extension), text);
}
