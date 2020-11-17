import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";
import ReactDOM from "react-dom";
import {
  EditorView,
  DirectEditorProps,
  Decoration,
  NodeView,
} from "prosemirror-view";
import { EditorState } from "prosemirror-state";
import { Node as ProsemirrorNode, DOMSerializer } from "prosemirror-model";
import produce from "immer";
import remove from "lodash.remove";

import { ExtensionContext, ExtensionView } from "./extension";
import Manager, { Events, EventHandler, Extension } from "./manager";

var counter = 0;

export function useExtension(extension: Extension) {
  const seq = useRef(++counter);
  const { dispatch } = useContext(ExtensionContext);

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

export function useManager(element: HTMLDivElement | null) {
  type Extensions = ConstructorParameters<typeof Manager>[0];
  type ExtensionViews = Record<string, ExtensionView>;

  const [view, setView] = useState<EditorView>();
  const [extensions, setExtensions] = useState<Extensions>({});
  const [extensionViews, setExtensionViews] = useState<ExtensionViews>({});

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

      if (!dom) {
        dom = document.createElement("div");
      }

      setExtensionViews((extensionViews) =>
        produce(extensionViews, (draft: ExtensionViews) => {
          draft[name] = {
            dom,
            node,
            getPos,
            decorations,
          };
        })
      );

      return {
        dom,
        contentDOM,
        update: (node: ProsemirrorNode, decorations: Decoration[]) => {
          setExtensionViews((extensionViews) =>
            produce(extensionViews, (draft: ExtensionViews) => {
              const extensionView = draft[name];
              extensionView.node = node;
              extensionView.decorations = decorations;
            })
          );
          return true;
        },
        destroy: () => {
          setExtensionViews((portals) =>
            produce(portals, (draft) => {
              delete draft[name];
            })
          );
        },
      } as NodeView;
    };
  }, []);

  const dispatch = useCallback<EventHandler>((event, name, data) => {
    switch (event) {
      case "load": {
        setExtensions((extensions) =>
          produce(extensions, (draft) => {
            if (!draft[name]) {
              draft[name] = [];
            }
            const target = data as Events["load"];
            if (!draft[name].find((x) => x.id === target.id)) {
              draft[name].push(target);
            }
          })
        );
        break;
      }
      case "off-load": {
        setExtensions((extensions) =>
          produce(extensions, (draft) => {
            if (!draft[name]) {
              return;
            }
            const id = data as Events["off-load"];
            remove(draft[name], (item) => item.id === id);
            if (draft[name].length === 0) {
              delete draft[name];
            }
          })
        );
        break;
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      view?.destroy();
    };
  }, [view]);

  useEffect(() => {
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
  }, [extensions, element]);

  return { view, dispatch, extensionViews };
}
