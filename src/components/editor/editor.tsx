import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { EditorView } from "prosemirror-view";

import { Context } from "./extension";
import { useManager } from "./manager";

import "./style.scss";

interface Handle {
  view?: EditorView | undefined;
}

interface Props {
  style?: Record<string, string | number>;
  children?: React.ReactNode;
}

export default forwardRef<Handle, Props>(function Editor(props, ref) {
  const { style, children } = props || {};
  const divRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();

  const [state, dispatch] = useManager();
  const [view, setView] = useState<EditorView>();

  useEffect(() => {
    if (!state || !divRef.current) {
      return;
    }

    if (!viewRef.current) {
      const view = new EditorView(divRef.current, { state });
      viewRef.current = view;
      setView(view);
    } else {
      viewRef.current.updateState(state);
    }
  }, [state]);

  useEffect(() => {
    return () => {
      view?.destroy();
    };
  }, [view]);

  useImperativeHandle(
    ref,
    () => ({
      view,
    }),
    [view]
  );

  return (
    <div ref={divRef} className="editor" style={style}>
      <Context.Provider value={{ view, dispatch }}>{children}</Context.Provider>
    </div>
  );
});
