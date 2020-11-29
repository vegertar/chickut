import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import ReactDOM from "react-dom";
import { EditorView } from "prosemirror-view";
import { Selection } from "prosemirror-state";

import { useManager } from "./hooks";
import { ExtensionProvider } from "./extension";

import "./style.scss";

interface Handle {
  view?: EditorView | undefined;
}

interface Props {
  style?: Record<string, string | number>;
  children?: React.ReactNode;
  autoFix?: boolean;
}

function focus(view: EditorView) {
  const selection = Selection.atEnd(view.state.doc);
  const transaction = view.state.tr.setSelection(selection);
  view.dispatch(transaction);
  view.focus();
  return view;
}

function applyDevTools(view: EditorView) {
  const DEVTOOLS_CLASS_NAME = "__prosemirror-dev-tools__";
  const place = document.querySelector(`.${DEVTOOLS_CLASS_NAME}`);
  if (place) {
    ReactDOM.unmountComponentAtNode(place);
    place.remove();
  }

  require("prosemirror-dev-tools").applyDevTools(view);
}

export default forwardRef<Handle, Props>(function Editor(props, ref) {
  const { style, children, autoFix } = props || {};
  const divRef = useRef<HTMLDivElement>(null);
  const context = useManager(divRef.current, autoFix);
  const { view } = context;

  useEffect(() => {
    if (view) {
      applyDevTools(view);
      // focus(view);
    }
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
      <ExtensionProvider {...context}>{children}</ExtensionProvider>
    </div>
  );
});
