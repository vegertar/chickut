import React, { useEffect, useRef, useReducer } from "react";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { Schema, ExtensionProps, ExtensionAction } from "../extensions";
import { specs as docSpecs } from "../extensions/nodes/doc";
import { specs as textSpecs } from "../extensions/nodes/text";
import { specs as paragraphSpecs } from "../extensions/nodes/paragraph";

import "./style.scss";

type ExtensionElement = React.ReactElement<ExtensionProps>;
type Extensions = ExtensionElement[] | ExtensionElement;

interface Props {
  readOnly?: boolean;
  readOnlyWriteCheckboxes?: boolean;
  className?: string;
  style?: Record<string, string | number>;
  children?: Extensions;
}

interface State {
  view?: EditorView<Schema>;
}

interface Action extends ExtensionAction {
  view?: EditorView<Schema>;
}

function reducer(state: State, action: Action) {
  let forceRender = false;
  const view = action.view || state.view;

  if (action.view) {
    forceRender = true;
  }
  if (action.state) {
    view?.updateState(action.state);
    forceRender = true;
  }

  if (action.transcations) {
    // TODO:
  }

  return forceRender ? { ...state, view } : state;
}

export default function Editor({
  readOnly,
  readOnlyWriteCheckboxes,
  style,
  className = `editor ${readOnly ? "read-only" : ""} ${
    readOnly && readOnlyWriteCheckboxes ? "write-checkboxes" : ""
  }`,
  children,
}: Props = {}) {
  const props = useRef<Props>({});
  const element = useRef<HTMLDivElement>(null);
  const [editor, dispatch] = useReducer(reducer, {});

  useEffect(() => {
    props.current.readOnly = readOnly;
    props.current.readOnlyWriteCheckboxes = readOnlyWriteCheckboxes;
  });

  useEffect(() => {
    if (!element.current) {
      return;
    }

    const view = new EditorView(element.current, {
      state: EditorState.create({
        schema: new Schema({
          nodes: {
            ...docSpecs,
            ...textSpecs,
            ...paragraphSpecs,
          },
        }),
      }),
      editable: () => !props.current.readOnly,
      dispatchTransaction: (tr) => {
        dispatch(view.state.applyTransaction(tr));
      },
    });

    dispatch({ view });
    return () => {
      view.destroy();
    };
  }, []);

  useEffect(() => {
    if (editor.view) {
      const { marks, nodes } = editor.view.state.schema;
      console.log(
        `loaded:\n\tmarks: ${Object.keys(marks)}\n\tnodes: ${Object.keys(
          nodes
        )}\n`
      );
    }
  }, [editor]);

  return (
    <div ref={element} className={className} style={style}>
      {children &&
        editor.view &&
        React.Children.map(children, (child) =>
          React.cloneElement(child, {
            view: editor.view,
            dispatch,
          })
        )}
    </div>
  );
}
