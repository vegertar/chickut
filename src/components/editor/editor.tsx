import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import ReactDOM from "react-dom";
import { EditorView } from "prosemirror-view";
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

function applyDevTools(view: EditorView) {
  if (process.env.JEST_WORKER_ID === undefined) {
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
    if (process.env.NODE_ENV !== "production") {
      if (typeof window !== "undefined") {
        (window as any).view = view;
      }
      view && applyDevTools(view);
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
