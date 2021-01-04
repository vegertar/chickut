import {
  MarkType,
  NodeType,
  Node as ProsemirrorNode,
  DOMSerializer,
  Slice,
} from "prosemirror-model";
import {
  PluginKey,
  Plugin as ProsemirrorPlugin,
  EditorState,
  Transaction,
} from "prosemirror-state";
import {
  Decoration,
  DecorationSet,
  EditorProps,
  EditorView,
  NodeView,
} from "prosemirror-view";

import { ExtensionSchema as S } from "./types";

export class Plugin<T = any> extends ProsemirrorPlugin<T, S> {
  constructor(key: string, props?: EditorProps<ProsemirrorPlugin<T, S>, S>) {
    super({
      key: new PluginKey(key),
      state: {
        init(config, instance) {
          const self = this as ExtensionPlugin;
          return self.initState?.(config, instance);
        },
        apply(tr, value, oldState, newState) {
          const self = this as ExtensionPlugin;
          return self.applyState?.(tr, value, oldState, newState);
        },
      },
      props: {
        handleTextInput(view, from, to, text) {
          const self = this as ExtensionPlugin;
          return !!self.handleTextInput?.(view, from, to, text);
        },

        handlePaste(view, event, slice) {
          const self = this as ExtensionPlugin;
          return !!self.handlePaste?.(view, event, slice);
        },

        handleKeyDown: function (view, event) {
          const self = this as ExtensionPlugin;
          return self.handleKeyDown?.(view, event) || false;
        },

        decorations(state) {
          const self = this as ExtensionPlugin;
          return self.decorations?.(state);
        },

        ...props,
      },
    });
  }

  //
  // State
  //

  initState?: (config: Record<string, any>, instance: EditorState<S>) => T;
  applyState?: (
    tr: Transaction<S>,
    value: T,
    oldState: EditorState<S>,
    newState: EditorState<S>
  ) => T;

  //
  // Event handler
  //

  handleTextInput?: (
    view: EditorView<S>,
    from: number,
    to: number,
    text: string
  ) => boolean;

  handlePaste?: (
    view: EditorView<S>,
    event: ClipboardEvent,
    slice: Slice<S>
  ) => boolean;

  handleKeyDown?: (view: EditorView<S>, event: KeyboardEvent) => boolean;

  //
  // Decorations
  //

  decorations?: (state: EditorState<S>) => DecorationSet;
}

export class ExtensionPlugin<T = any> extends Plugin<T> {
  readonly name = this.type.name;
  readonly engine = this.type.schema.cached.engine;
  readonly schema = this.type.schema;

  constructor(
    public readonly type: NodeType<S> | MarkType<S>,
    props?: EditorProps<ProsemirrorPlugin<T, S>, S>
  ) {
    super(type.name, {
      nodeViews: {
        [type.name]: (
          node: ProsemirrorNode,
          view: EditorView,
          getPos: boolean | (() => number),
          decorations: Decoration[]
        ) => {
          return this.createNodeView?.(
            node,
            view,
            getPos,
            decorations
          ) as NodeView;
        },
      },

      ...props,
    });
  }

  //
  // Node view
  //

  createNodeView?: (
    node: ProsemirrorNode<S>,
    view: EditorView,
    getPos: boolean | (() => number),
    decorations: Decoration[]
  ) => NodeView;

  static createDefaultNode(node: ProsemirrorNode<S>) {
    const spec = node.type.spec.toDOM?.(node);
    return spec ? DOMSerializer.renderSpec(document, spec) : undefined;
  }
}
