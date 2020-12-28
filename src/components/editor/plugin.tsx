import React from "react";
import { Keymap } from "prosemirror-commands";
import { keydownHandler } from "prosemirror-keymap";
import {
  MarkType,
  NodeType,
  Node as ProsemirrorNode,
  DOMSerializer,
  ResolvedPos,
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

        handleKeyDown: function (view, event) {
          const self = this as ExtensionPlugin;
          if (self.handleKeyDown) {
            return self.handleKeyDown(view, event);
          }
          return self.keys ? keydownHandler(self.keys)(view, event) : false;
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

  handleKeyDown?: (view: EditorView<S>, event: KeyboardEvent) => boolean;

  //
  // Keys
  //

  keys?: Keymap<S>;

  //
  // Decorations
  //

  decorations?: (state: EditorState<S>) => DecorationSet;
}

type NodeViewDOMs = Pick<NodeView, "dom" | "contentDOM">;

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
          const doms = this.createNode?.(
            node,
            view,
            getPos,
            decorations
          ) as NodeViewDOMs;
          if (!doms || (!doms.dom && !doms.contentDOM)) {
            return (null as any) as NodeView;
          }

          const {
            updateNode,
            selectNode,
            deselectNode,
            setNodeSelection,
            stopNodeEvent,
            ignoreNodeMutation,
            destroyNode,
          } = this;

          return {
            ...doms,

            update:
              updateNode &&
              ((node, decorations) => updateNode(node, decorations, doms)),

            selectNode: selectNode && (() => selectNode(doms)),

            deselectNode: deselectNode && (() => deselectNode(doms)),

            setSelection:
              setNodeSelection &&
              ((a, b, c) => setNodeSelection(a, b, c, doms)),

            stopEvent: stopNodeEvent && ((x) => stopNodeEvent(x, doms)),

            ignoreMutation:
              ignoreNodeMutation && ((x) => ignoreNodeMutation(x, doms)),

            destroy: destroyNode && (() => destroyNode(doms)),
          };
        },
      },

      ...props,
    });
  }

  textBefore($from: ResolvedPos<S>, max = 500) {
    return $from.parent.textBetween(
      Math.max(0, $from.parentOffset - max),
      $from.parentOffset,
      undefined,
      "\ufffc"
    );
  }

  //
  // Node view
  //

  static createDefaultNode(node: ProsemirrorNode<S>) {
    const { parseDOM, toDOM } = node.type.spec;
    if (parseDOM) {
    }

    const spec = toDOM?.(node);
    return spec ? DOMSerializer.renderSpec(document, spec) : undefined;
  }

  static Template: React.FC<{ name: string; children: string }> = ({
    name,
    children,
  }) => (
    <template className={name} dangerouslySetInnerHTML={{ __html: children }} />
  );

  static createTemplateNode(node: ProsemirrorNode<S>) {
    const parseDOM = node.type.spec.parseDOM;
    if (!parseDOM) {
      return;
    }

    const name = node.type.name;
    const template = document.querySelector(`template.${name}`);
    if (!template) {
      return;
    }

    const content = (template as HTMLTemplateElement).content;
    if (!content.firstElementChild) {
      return;
    }

    for (const { tag, contentElement } of parseDOM) {
      if (typeof tag !== "string") {
        continue;
      }

      const dom = content.querySelector(tag)?.cloneNode(true);
      if (!dom) {
        continue;
      }

      const contentDOM =
        typeof contentElement === "string"
          ? (dom as HTMLElement).querySelector(contentElement)
          : contentElement?.(dom);

      return { dom, contentDOM };
    }
  }

  createNode?: (
    node: ProsemirrorNode<S>,
    view: EditorView,
    getPos: boolean | (() => number),
    decorations: Decoration[]
  ) => Pick<NodeView, "dom" | "contentDOM">;

  updateNode?: (
    node: ProsemirrorNode<S>,
    decorations: Decoration[],
    doms: NodeViewDOMs
  ) => boolean;

  selectNode?: (doms: NodeViewDOMs) => void;

  deselectNode?: (doms: NodeViewDOMs) => void;

  setNodeSelection?: (
    anchor: number,
    head: number,
    root: Document,
    doms: NodeViewDOMs
  ) => void;

  stopNodeEvent?: (event: Event, doms: NodeViewDOMs) => boolean;

  ignoreNodeMutation?: (
    p:
      | MutationRecord
      | {
          type: "selection";
          target: Element;
        },
    doms: NodeViewDOMs
  ) => boolean;

  destroyNode?: (doms: NodeViewDOMs) => void;
}
