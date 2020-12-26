import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import ReactDOM from "react-dom";
import { EditorView } from "prosemirror-view";
import { AllSelection } from "prosemirror-state";
import ReactIs from "react-is";

import { EditorHandle } from "./types";
import { useManager } from "./hooks";
import { ExtensionProvider } from "./extension";

import "./style.scss";

interface Props {
  text?: string;
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

function useDevTools(editor?: EditorHandle) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      editor?.view && applyDevTools(editor.view);
    }
  }, [editor]);
}

export default forwardRef<EditorHandle, Props>(function Editor(props, ref) {
  const { text, style, children } = props || {};
  const divRef = useRef<HTMLDivElement>(null);
  const context = useManager(divRef.current);
  const editor = context.editor;

  useDevTools(editor);
  useImperativeHandle(ref, () => editor, [editor]);

  useEffect(() => {
    const view = editor?.view;

    if (
      text === undefined ||
      !view ||
      view.dom.parentElement !== divRef.current
    ) {
      return;
    }

    type HandleTextInput = NonNullable<typeof view["props"]["handleTextInput"]>;

    const { from, to } = new AllSelection(view.state.doc);

    if (
      !view.someProp("handleTextInput", (f: HandleTextInput) =>
        f(view, from, to, text)
      )
    ) {
      view.dispatch(
        view.state.tr.delete(from, to).insertText(text).scrollIntoView()
      );
    }
  }, [text, editor]);

  return (
    <div ref={divRef} className="editor" style={style}>
      <ExtensionProvider {...context}>
        {flatFragment(children)}
      </ExtensionProvider>
    </div>
  );
});
