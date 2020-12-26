import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import ReactDOM from "react-dom";
import { EditorView } from "prosemirror-view";
import ReactIs from "react-is";

import { useManager, useContentDOM, EditorHandle } from "./hooks";
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

function normalizeText(text?: string) {
  return text?.replace(/\r\n?|\n/g, "\u2424");
}

function useTextContent(editor?: EditorHandle, text?: string) {
  const domRef = useRef<HTMLElement>();
  const dom = useContentDOM(editor?.view);

  useEffect(() => {
    domRef.current = dom;
  }, [dom]);

  useEffect(() => {
    if (!domRef.current) {
      return;
    }
    const textContent = normalizeText(text);
    if (textContent !== undefined) {
      domRef.current.textContent = textContent;
    }
  }, [text, editor?.version]);
}

export default forwardRef<EditorHandle, Props>(function Editor(props, ref) {
  const { text, style, children } = props || {};
  const divRef = useRef<HTMLDivElement>(null);
  const context = useManager(divRef.current);
  const editor = context.editor;
  const editorView = editor?.view;

  useTextContent(context.editor, text);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      editorView && applyDevTools(editorView);
    }
  }, [editorView]);

  useImperativeHandle(ref, () => editor, [editor]);

  return (
    <div ref={divRef} className="editor" style={style}>
      <ExtensionProvider {...context}>
        {flatFragment(children)}
      </ExtensionProvider>
    </div>
  );
});
