import React, { useEffect, useRef, useReducer, useState } from "react";
import { EditorState, Selection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import {
  Schema as ExtensionSchema,
  Action as ExtensionAction,
  Context as ExtensionContext,
  Schema,
} from "../extensions/extension";
import { specs as docSpecs } from "../extensions/nodes/doc";
import { specs as textSpecs } from "../extensions/nodes/text";
import { specs as paraSpecs } from "../extensions/nodes/paragraph";

import "./style.scss";

type Child = string | React.ReactElement;

interface Props {
  autoFocus?: boolean;
  readOnly?: boolean;
  readOnlyWriteCheckboxes?: boolean;
  className?: string;
  style?: Record<string, string | number>;
  children?: Child | Child[];
}

interface State {
  view?: EditorView<ExtensionSchema>;
}

interface Action extends ExtensionAction {
  view?: EditorView<ExtensionSchema>;
}

function reducer(state: State, action: Action) {
  let forceRender = false;
  const view = action.view || state.view;

  if (action.view) {
    forceRender = true;
  }

  if (action.state) {
    forceRender = true;
    view?.updateState(action.state);
  }

  if (action.transactions) {
    // TODO:
  }

  return forceRender ? { ...state, view } : state;
}

function focusAtEnd(view: EditorView<Schema>) {
  const selection = Selection.atEnd(view.state.doc);
  const transaction = view.state.tr.setSelection(selection);
  view.dispatch(transaction);
  view.focus();
}

export default function Editor({
  autoFocus,
  readOnly,
  readOnlyWriteCheckboxes,
  style,
  className = `editor${readOnly ? " read-only" : ""}${
    readOnly && readOnlyWriteCheckboxes ? " write-checkboxes" : ""
  }`,
  children,
}: Props = {}) {
  const props = useRef<Props>({});
  const element = useRef<HTMLDivElement>(null);
  const [editor, dispatch] = useReducer(reducer, {});
  const [doc, setDoc] = useState("");
  const { view } = editor;

  useEffect(() => {
    props.current.readOnly = readOnly;
    props.current.readOnlyWriteCheckboxes = readOnlyWriteCheckboxes;
  });

  useEffect(() => {
    if (!element.current) {
      return;
    }

    const schema = new ExtensionSchema({
      nodes: {
        ...docSpecs,
        ...textSpecs,
        ...paraSpecs,
      },
    });

    const view = new EditorView(element.current, {
      state: EditorState.create({ schema }),
      editable: () => !props.current.readOnly,
      dispatchTransaction: (tr) => {
        // TODO: dispatch tr directly?
        dispatch(view.state.applyTransaction(tr));
      },
    });

    dispatch({ view });
    return () => {
      view.destroy();
    };
  }, []);

  useEffect(() => {
    const s: string[] = [];
    React.Children.forEach(children, (child) => {
      if (typeof child === "string") {
        s.push(child);
      }
    });
    setDoc(s.join("\n"));
  }, [children]);

  useEffect(() => {
    if (!view) {
      return;
    }
  }, [doc, view]);

  useEffect(() => {
    if (!autoFocus || !view) {
      return;
    }

    focusAtEnd(view);
  }, [autoFocus, view]);

  return (
    <div ref={element} className={className} style={style}>
      <ExtensionContext.Provider value={{ view, dispatch }}>
        {children &&
          view &&
          React.Children.map(children, (child) =>
            typeof child === "string" ? null : child
          )}
      </ExtensionContext.Provider>
    </div>
  );
}
