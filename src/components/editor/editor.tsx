import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import ReactDOM from "react-dom";
import { EditorView } from "prosemirror-view";
import { Selection } from "prosemirror-state";
import ReactIs from "react-is";

import { useManager } from "./hooks";
import { ExtensionProvider } from "./extension";

import "./style.scss";

interface Handle {
  view?: EditorView | undefined;
}

interface Props {
  style?: Record<string, string | number>;
  children?: React.ReactNode;
}

function focus(view: EditorView) {
  const selection = Selection.atEnd(view.state.doc);
  const transaction = view.state.tr.setSelection(selection);
  view.dispatch(transaction);
  view.focus();
  return view;
}

function applyDevTools(view: EditorView) {
  if (process.env.NODE_ENV !== "production") {
    const DEVTOOLS_CLASS_NAME = "__prosemirror-dev-tools__";
    const place = document.querySelector(`.${DEVTOOLS_CLASS_NAME}`);
    if (place) {
      ReactDOM.unmountComponentAtNode(place);
      place.remove();
    }

    require("prosemirror-dev-tools").applyDevTools(view);
  }
}

function flatFragment(children: React.ReactNode) {
  const data: React.ReactNode[] = [];
  React.Children.forEach(children, (child) => {
    if (ReactIs.isFragment(child)) {
      data.push(...child.props.children);
    } else {
      data.push(child);
    }
  });
  return data;
}

export default forwardRef<Handle, Props>(function Editor(props, ref) {
  const { style, children } = props || {};
  const divRef = useRef<HTMLDivElement>(null);
  const context = useManager(divRef.current);
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
      <ExtensionProvider {...context}>
        {flatFragment(children)}
      </ExtensionProvider>
    </div>
  );
});
