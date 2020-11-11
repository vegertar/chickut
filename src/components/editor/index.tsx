import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import produce from "immer";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema } from "prosemirror-model";

import "./style.scss";

type EventType = "load" | "off-load";

type ContextProps = {
  view?: EditorView;
  dispatch?: (
    event: EventType,
    target: string,
    error?: any,
    data?: any
  ) => void;
};

export const Context = React.createContext<ContextProps>({});

interface Handler {
  view?: EditorView | undefined;
  events: Parameters<NonNullable<ContextProps["dispatch"]>>[];
}

interface Props {
  className?: string;
  style?: Record<string, string | number>;
  children?: React.ReactNode;
}

export default forwardRef<Handler, Props>(function Editor(props, ref) {
  const { className = "editor", style, children } = props || {};
  const element = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<EditorView>();
  const [events, setEvents] = useState<Handler["events"]>([]);
  const dispatch = useCallback<NonNullable<ContextProps["dispatch"]>>(
    (event, target, error, data) => {
      setEvents((events) =>
        produce(events, (draft) => {
          draft.push([event, target, error, data]);
        })
      );
    },
    []
  );

  useEffect(() => {
    if (!element.current) {
      return;
    }

    const view = new EditorView(element.current, {
      state: EditorState.create({
        // a trivial schema just to create a valid EditorState
        schema: new Schema({
          nodes: {
            doc: {
              content: "text*",
              attrs: {
                trivial: { default: true },
              },
            },
            text: {},
          },
        }),
      }),
    });

    setView(view);
    return () => {
      view.destroy();
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      view,
      events,
    }),
    [view, events]
  );

  return (
    <div ref={element} className={className} style={style}>
      <Context.Provider value={{ view, dispatch }}>{children}</Context.Provider>
    </div>
  );
});
