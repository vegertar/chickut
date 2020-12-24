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
  NodeExtension,
  Schema,
} from "./manager";

var seq = 0;

export type ContentView = {
  id: string;
  dom: HTMLElement;
  contentDOM: HTMLElement;
  content: React.ReactNode;
  node: ProsemirrorNode;
  getPos: boolean | (() => number);
  decorations: Decoration[];
};

export type ExtensionView = ContentView[];

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
  extensionVersion?: number;
  dispatch?: React.Dispatch<Action>;
};

const ExtensionContext = createContext<ExtensionContextProps>({});

export const ExtensionContextProvider = ExtensionContext.Provider;

export interface ExtensionState {
  extensions: Record<string, Extension>;
  extensionViews: Record<string, ExtensionView>;
  extensionPacks: Record<string, string[]>;
  extensionVersions: Record<string, number>;
}

interface Action extends Partial<Events> {
  target: string;
}

// IMPORTANT: reducer should be a pure function, so Action should be a pure action as well
function reducer(state: ExtensionState, action: Action) {
  const target = action.target;
  console.info(action, state.extensionVersions[target]);

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

      if (!draft.extensionVersions[target]) {
        draft.extensionVersions[target] = 0;
      }
      draft.extensionVersions[target] += 1;
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

      draft.extensionVersions[target] += 1;
    });
  }

  if (action["create-view"]) {
    const data = action["create-view"];
    return produce(state, (draft: ExtensionState) => {
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
  if (!node.type.spec.content) {
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
  const [editorView, setEditorView] = useState<EditorView>();
  const [{ extensions, ...context }, dispatch] = useReducer(reducer, {
    extensions: {},
    extensionViews: {},
    extensionPacks: {},
    extensionVersions: {},
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
        editorView?.destroy();
      };
    },
    [editorView]
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
          // TODO: set error boundry
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
        setEditorView(view);
      }
    },
    [extensions, createNodeView, element]
  );

  return { editorView, dispatch, ...context };
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
  return node && (node.type.spec as NodeExtension["node"]).toText?.(node);
}

function toContentView(data: ReturnType<typeof useContentView>) {
  const contentView = data as ContentView | undefined;
  return contentView?.dom && contentView;
}

// TODO: distinguish text input mode
type TextInputMode = "typing" | "pasting";

function normalizeText(text?: string) {
  return text?.replace(/\r\n/g, "\n").replace(/\n/g, "\u2424");
}

export function useTextContent(
  context: ReturnType<typeof useExtension>,
  text?: string,
  mode?: TextInputMode
) {
  const { editorView, extensionView, extensionVersion } = context;
  const contentView = useContentView(editorView, extensionView);
  const [textContent, setTextContent] = useState<string>();
  const [isDelayed, setIsDelayed] = useState(0);

  const idRef = useRef<string>();
  const verRef = useRef<number>();
  const id = contentView?.id;
  const $contentView = toContentView(contentView);

  useEffect(() => {
    // we got a new extension but the content dom has not been updated yet
    if (id === idRef.current && extensionVersion !== verRef.current) {
      setIsDelayed((x) => x + 1);
    }
    idRef.current = id;
    verRef.current = extensionVersion;
  }, [extensionVersion, id]);

  useEffect(() => {
    if (text !== undefined && text !== toText($contentView?.node)) {
      setTextContent(normalizeText(text));
    }
  }, [$contentView, text]);

  useEffect(() => {
    const id = idRef.current;
    const contentDOM = id && document.getElementById(id);
    if (contentDOM && textContent !== undefined) {
      contentDOM.textContent = textContent;
    }
  }, [textContent, extensionVersion, isDelayed]);

  return {
    ...context,
    contentView: $contentView,
  };
}

export function useTextExtension(
  extension: Extension | ExtensionPack,
  text?: string,
  mode: TextInputMode = "typing"
) {
  return useTextContent(useExtension(extension), text, mode);
}
