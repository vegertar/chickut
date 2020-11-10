import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema } from "prosemirror-model";

import "./style.scss";

interface Props {
  className?: string;
  style?: Record<string, string | number>;
  children?: React.ReactNode;
}

export default forwardRef<EditorView | undefined, Props>(function Editor(
  props,
  ref
) {
  const { className = "editor", style, children } = props || {};
  const state = useRef<{ view?: EditorView } & Props>({});
  const element = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!element.current) {
      return;
    }

    const schema = new Schema({
      nodes: {
        doc: {},
        paragraph: {},
        text: {},
      },
    });

    const view = new EditorView(element.current, {
      state: EditorState.create({ schema }),
    });

    if (process.env.NODE_ENV !== "production") {
      require("prosemirror-dev-tools").applyDevTools(view);
      if (typeof Window !== "undefined") {
        (Window as any).view = view;
      }
    }

    state.current.view = view;
    return () => {
      view.destroy();
    };
  }, []);

  useImperativeHandle(ref, () => state.current.view);

  return (
    <div ref={element} className={className} style={style}>
      {children}
    </div>
  );
});
