import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useReducer,
  useRef,
} from "react";
import { EditorView } from "prosemirror-view";
import produce from "immer";

import { Manager, MissingContentError } from "./manager";
import {
  Extension,
  ExtensionState,
  ExtensionAction,
  ExtensionEvents,
  ExtensionContextProps,
  ExtensionPack,
  ExtensionSchema,
  EditorHandle,
} from "./types";

// IMPORTANT: reducer should be a pure function, so Action should be a pure action as well
function reducer(state: ExtensionState, action: ExtensionAction) {
  const target = action.target;
  console.info(action, new Date().getTime());

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

  return state;
}

export function useManager(element: HTMLDivElement | null) {
  const [editor, setEditor] = useState<EditorHandle>({ version: 0 });
  const viewRef = useRef<EditorView<ExtensionSchema>>();
  const view = editor.view;

  const [{ extensions }, dispatch] = useReducer(reducer, {
    extensions: {},
    packs: {},
  });

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

      const props = config;
      if (viewRef.current?.dom.parentElement === element) {
        viewRef.current.update(props);
        setEditor((editor) =>
          produce(editor, (draft) => {
            draft.version += 0.000001; // minor change
          })
        );
      } else {
        const view = new EditorView<ExtensionSchema>(element, {
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
            draft.version += 1; // major change
            draft.view = view;
          })
        );
      }
    },
    [extensions, element]
  );

  return { editor, dispatch };
}

const ExtensionContext = createContext<ExtensionContextProps>({});

export const ExtensionContextProvider = ExtensionContext.Provider;

export function useExtensionContext(name: string) {
  const { dispatch, ...context } = useContext(ExtensionContext);
  const extensionDispatch = useCallback(
    (events: Partial<ExtensionEvents>) => {
      name && dispatch?.({ ...events, target: name });
    },
    [name, dispatch]
  );

  return { ...context, dispatch: extensionDispatch, name };
}

export function useExtension(
  extension: Extension | ExtensionPack,
  name: string
) {
  const context = useExtensionContext(name);
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
