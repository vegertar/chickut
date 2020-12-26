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
import { DOMSerializer, Node as ContentNode } from "prosemirror-model";
import produce from "immer";
import remove from "lodash.remove";

import Manager, {
  Extension,
  ExtensionPack,
  MarkExtension,
  MissingContentError,
  NodeExtension,
  Schema,
} from "./manager";

var seq = 0;

export type ContentView<T extends Extension = Extension> = {
  id: string;
  dom: HTMLElement;
  contentDOM: HTMLElement;
  content: React.ReactNode;
  node: ContentNode<Schema>;
  getPos: T extends NodeExtension
    ? () => number
    : T extends MarkExtension
    ? boolean
    : never;
  decorations: Decoration[];
};

export type ExtensionView<T extends Extension = Extension> = ContentView<T>[];

interface Events {
  load: Extension | ExtensionPack;
  ["off-load"]: Extension | ExtensionPack;
  ["create-view"]: ContentView;
  ["update-view"]: Pick<ContentView, "id" | "node" | "decorations">;
  ["destroy-view"]: Pick<ContentView, "id">;
}

interface Action extends Partial<Events> {
  target: string;
}

export interface ExtensionState {
  extensions: Record<string, Extension>;
  views: Record<string, ExtensionView>;
  packs: Record<string, string[]>;
}

// IMPORTANT: reducer should be a pure function, so Action should be a pure action as well
function reducer(state: ExtensionState, action: Action) {
  const target = action.target;
  console.info(action);

  if (action.load) {
    const data = action.load;
    return produce(state, (draft) => {
      if (Array.isArray(data)) {
        if (state.packs[target] !== undefined) {
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
        draft.packs[target] = pack;
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
        delete draft.packs[target];
      } else {
        delete draft.extensions[target];
      }
    });
  }

  if (action["create-view"]) {
    const data = action["create-view"];
    return produce(state, (draft: ExtensionState) => {
      if (!draft.views[target]) {
        draft.views[target] = [];
      }
      draft.views[target].push(data);
    });
  }

  if (action["update-view"]) {
    const data = action["update-view"];
    return produce(state, (draft) => {
      const nodeViews = draft.views[target];
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
      const nodeViews = draft.views[target];
      remove(nodeViews, (item) => item.id === data.id);
      if (nodeViews.length === 0) {
        delete draft.views[target];
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

function createDOM(node: ContentNode) {
  const dom = node.isInline
    ? document.createElement("span")
    : document.createElement("div");
  return dom;
}

function createViewDOMs(name: string, node: ContentNode) {
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

export type EditorHandle = {
  view?: EditorView<Schema>;
  version: number;
};

export function useManager(element: HTMLDivElement | null) {
  const [editor, setEditor] = useState<EditorHandle>({ version: 0 });
  const viewRef = useRef<EditorView<Schema>>();
  const view = editor.view;

  const [{ extensions, ...context }, dispatch] = useReducer(reducer, {
    extensions: {},
    views: {},
    packs: {},
  });

  const createContentView = useCallback((name: string) => {
    return (
      node: ContentNode,
      view: EditorView<Schema>,
      getPos: boolean | (() => number),
      decorations: Decoration[]
    ) => {
      const doms = createViewDOMs(name, node);
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
        update: (node: ContentNode, decorations: Decoration[]) => {
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

      let config: ReturnType<Manager["createConfig"]>;
      try {
        config = new Manager(extensions).createConfig();
      } catch (e) {
        if (e instanceof MissingContentError) {
          // TODO: set error boundry
          console.warn(e);
          return;
        }
        throw e;
      }

      if (!config) {
        return;
      }

      const nodeViews = Object.keys(extensions).reduce(
        (all, name) => ({
          ...all,
          [name]: createContentView(name),
        }),
        {} as Record<string, ReturnType<typeof createContentView>>
      );

      const props = { ...config, nodeViews };
      if (viewRef.current) {
        viewRef.current.setProps(props);
        setEditor((editor) =>
          produce(editor, (draft) => {
            draft.version += 1;
          })
        );
      } else {
        const view = new EditorView<Schema>(element, {
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
        setEditor((editor) =>
          produce(editor, (draft: EditorHandle) => {
            draft.version += 1;
            draft.view = view;
          })
        );
      }
    },
    [extensions, createContentView, element]
  );

  return { editor, dispatch, extension: context };
}

export type ExtensionContextProps = {
  editor?: EditorHandle;
  view?: ExtensionView;
  name?: string;
  dispatch?: React.Dispatch<Action>;
};

const ExtensionContext = createContext<ExtensionContextProps>({});

export const ExtensionContextProvider = ExtensionContext.Provider;

export function useExtensionContext() {
  const { dispatch, name, ...context } = useContext(ExtensionContext);
  const extensionDispatch = useCallback(
    (events: Partial<Events>) => {
      name && dispatch?.({ ...events, target: name });
    },
    [name, dispatch]
  );

  return { ...context, dispatch: extensionDispatch, name };
}

type ExtensionContextType<T extends Extension> = Omit<
  ReturnType<typeof useExtensionContext>,
  "view"
> & {
  view?: ContentView<T>[];
};

export function useExtension<T extends NodeExtension>(
  extension: T | ExtensionPack<T>
): ExtensionContextType<NodeExtension>;
export function useExtension<T extends MarkExtension>(
  extension: T | ExtensionPack<T>
): ExtensionContextType<MarkExtension>;
export function useExtension<T extends Extension>(
  extension: T | ExtensionPack<T>
): ExtensionContextType<Extension>;
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

export function useContentDOM(editorView?: EditorView) {
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

  if (
    node instanceof HTMLElement &&
    node.classList.contains("extension-content")
  ) {
    return node;
  }
}

export function useContentView<T extends Extension>(
  view?: ExtensionView<T>,
  editorView?: EditorView
) {
  const node = useContentDOM(editorView);
  if (node && view) {
    for (const nodeView of view) {
      if (nodeView.contentDOM === node) {
        return nodeView;
      }
    }
  }
}
