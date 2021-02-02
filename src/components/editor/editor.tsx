import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import ReactDOM from "react-dom";
import { EditorView } from "prosemirror-view";
import { AllSelection, Selection } from "prosemirror-state";
import { Fragment, Slice } from "prosemirror-model";
import ReactIs from "react-is";

import { EditorHandle, ExtensionSchema } from "./types";
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

function applyText(view: EditorView, text: string) {
  const fragment = Fragment.from(view.state.schema.text(text));
  const slice = new Slice(fragment, 0, 0) as Slice<ExtensionSchema>;

  type HandlePaste = NonNullable<typeof view["props"]["handlePaste"]>;
  return view.someProp("handlePaste", (f: HandlePaste) =>
    f(view, new ClipboardEvent("paste"), slice)
  );
}

export default forwardRef<EditorHandle, Props>(function Editor(props, ref) {
  const { text, style, children } = props || {};
  const divRef = useRef<HTMLDivElement>(null);
  const context = useManager(divRef.current);
  const editor = context.editor;
  const view = editor?.view;
  const isValid = useCallback(
    ({ dom }: { dom: Element }) => dom.parentElement === divRef.current,
    []
  );

  useImperativeHandle(
    ref,
    () => {
      if (editor.view && !isValid(editor.view)) {
        return { version: editor.version };
      }
      return editor;
    },
    [editor, isValid]
  );

  useEffect(() => {
    if (!view || !isValid(view)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      applyDevTools(view);

      view.setProps({
        dispatchTransaction(tr) {
          console.log(
            "Document went from",
            `<${tr.before.content.size}>${tr.before.content
              .toString()
              .slice(0, 100)}...`,
            "to",
            `<${tr.doc.content.size}>${tr.doc.content
              .toString()
              .slice(0, 100)}...`
          );
          this.updateState(this.state.apply(tr));
        },
      });
    }
  }, [view, isValid]);

  useEffect(() => {
    const view = editor?.view;
    if (text === undefined || !view || !isValid(view)) {
      return;
    }

    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
    if (!applyText(view, text)) {
      view.dispatch(view.state.tr.insertText(text).scrollIntoView());
    }
    view.dispatch(view.state.tr.setSelection(Selection.atEnd(view.state.doc)));
    view.focus();
  }, [text, editor, isValid]);

  return (
    <div ref={divRef} className="editor" style={style}>
      <ExtensionProvider {...context}>
        {flatFragment(children)}
      </ExtensionProvider>
    </div>
  );
});
