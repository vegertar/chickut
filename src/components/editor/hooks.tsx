import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useReducer,
  useRef,
} from "react";
import { DirectEditorProps, EditorView } from "prosemirror-view";
import produce from "immer";

import { Manager, MissingContentError } from "./manager";
import {
  Extension,
  ExtensionState,
  ExtensionAction,
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
  const [editor, setEditor] = useState<EditorHandle>({ version: [0, 0] });
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

      let props: DirectEditorProps<ExtensionSchema> | undefined;
      try {
        props = new Manager(extensions).createConfig();
      } catch (e) {
        if (e instanceof MissingContentError) {
          // TODO: set error boundry
          console.warn(e);
          return;
        }
        throw e;
      }

      if (!props) {
        return;
      }

      if (viewRef.current?.dom.parentElement === element) {
        viewRef.current.update(props);
        setEditor((editor) =>
          produce(editor, (draft) => {
            draft.version[1] += 1; // minor change
          })
        );
      } else {
        const view = new EditorView<ExtensionSchema>(element, props);
        viewRef.current = view;
        setEditor((editor) =>
          produce(editor, (draft: EditorHandle) => {
            draft.version[0] += 1; // major change
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
    (action: Partial<ExtensionAction>) => {
      dispatch?.({ target: name, ...action });
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
