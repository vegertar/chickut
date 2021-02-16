import { diff_match_patch } from "diff-match-patch";
import {
  DOMSerializer,
  MarkType,
  Node as ProsemirrorNode,
  NodeType,
  Schema,
} from "prosemirror-model";
import { EditorView, NodeView as INodeView } from "prosemirror-view";
import { Plugin, PluginKey, PluginSpec, EditorState } from "prosemirror-state";
import { Command, exitCode } from "prosemirror-commands";
import assign from "lodash.assign";
import { ExtensionSchema } from "./types";

export const dmp = new diff_match_patch();

var seq = 0;

type Handle<T> = ((event: T) => void) | undefined;
type S = ExtensionSchema;

export class NodeView implements INodeView<S> {
  static createDefaultNode(node: ProsemirrorNode<S>) {
    const spec = node.type.spec.toDOM?.(node);
    return spec ? DOMSerializer.renderSpec(document, spec) : undefined;
  }

  static readonly createHandles = new Map<string, Handle<NodeView>>();
  static readonly updateHandles = new Map<string, Handle<string>>();
  static readonly destroyHandles = new Map<string, Handle<string>>();
  static readonly eventHandles = new Map<string, Handle<Event>>();

  readonly name: string;
  readonly id: string;

  dom: HTMLElement;
  contentDOM?: Node | null;

  constructor(
    protected node: ProsemirrorNode<S>,
    protected view: EditorView<S>,
    protected getPos: () => number,
    tag = "div"
  ) {
    this.name = node.type.name;
    this.id = `${node.type.name}-${new Date().getTime()}-${++seq}`;
    this.dom = document.createElement(tag);
    this.dom.className = this.name;
    this.dom.id = this.id;
    this.contentDOM = this.dom;

    this.render();
  }

  update(node: ProsemirrorNode<S>) {
    if (node.type !== this.node.type) {
      return false;
    }
    const oldNode = this.node;
    this.node = node;
    return this.render(oldNode) === false ? false : true;
  }

  destroy() {
    NodeView.destroyHandles.get(this.name)?.(this.id);
  }

  render(oldNode?: ProsemirrorNode<S>): boolean | void {
    if (!oldNode) {
      NodeView.createHandles.get(this.name)?.(this);
    } else {
      NodeView.updateHandles.get(this.name)?.(this.id);
    }
  }
}

// export class ProsedNodeView extends NodeView implements INodeView {
//   prose?: EditorView | null;

//   constructor(
//     node: ProsemirrorNode,
//     view: EditorView,
//     getPos: () => number,
//     tag?: string
//   ) {
//     super(node, view, getPos, tag);

//     if (node.attrs.prosing) {
//       const prose = new EditorView(this.dom, {
//         state: EditorState.create({
//           doc: node,
//           schema: new Schema({
//             nodes: {
//               text: {},
//               doc: { content: "text*" },
//             },
//           }),
//         }),
//         dispatchTransaction: (tr) => {
//           prose.updateState(prose.state.apply(tr));
//           if (tr.docChanged) {
//             const tr = this.changes(prose);
//             tr && this.view.dispatch(tr);
//           }
//         },
//       });

//       this.prose = prose;
//       this.contentDOM = null;
//     }
//   }

//   destroy() {
//     if (this.prose) {
//       this.prose.destroy();
//       this.prose = null;
//     }
//     super.destroy();
//   }

//   render(oldNode?: ProsemirrorNode): boolean | void {
//     if (oldNode && oldNode.attrs.prosing !== this.node.attrs.prosing) {
//       return false;
//     }
//     if (this.prose) {
//       const tr = this.changes(this.prose, true);
//       tr && this.prose.dispatch(tr);
//     }
//     return super.render(oldNode);
//   }

//   selectNode() {
//     this.view.dispatch(
//       this.view.state.tr.setNodeMarkup(this.getPos(), undefined, {
//         ...this.node.attrs,
//         prosing: true,
//       })
//     );
//   }

//   deselectNode() {
//     this.view.dispatch(
//       this.view.state.tr.setNodeMarkup(this.getPos(), undefined, {
//         ...this.node.attrs,
//         prosing: false,
//       })
//     );
//   }

//   keymaps(): Record<string, Command> {
//     return {
//       "Ctrl-Enter": () => {
//         if (exitCode(this.view.state, this.view.dispatch)) {
//           this.view.focus();
//         }
//         return true;
//       },
//     };
//   }

//   changes(prose: EditorView, downward = false) {
//     let oldOne = this.node.textContent;
//     let newOne = prose.state.doc.textContent;

//     if (downward) {
//       const t = oldOne;
//       oldOne = newOne;
//       newOne = t;
//     }

//     const diffs = dmp.diff_main(oldOne, newOne);
//     if (diffs.length) {
//       return null;
//     }

//     const tr = downward ? prose.state.tr : this.view.state.tr;

//     let index = this.getPos() + 1;
//     for (const [op, text] of diffs) {
//       switch (op) {
//         case 1: // insert
//           tr.insertText(text, index);
//           break;
//         case 0: // equal
//           index += text.length;
//           break;
//         case -1: // delete
//           tr.delete(index, index + text.length);
//           index += text.length;
//           break;
//       }
//     }

//     return tr;
//   }
// }

export class NodeViewPlugin<
  T extends NodeType | MarkType,
  U extends T extends NodeType ? () => number : MarkType
> extends Plugin {
  constructor(
    type: T,
    NodeViewClass: {
      new (node: ProsemirrorNode, view: EditorView, getPos: U): NodeView;
    },
    spec?: PluginSpec
  ) {
    super(
      assign<PluginSpec, PluginSpec | undefined>(
        {
          key: new PluginKey(type.name),
          props: {
            nodeViews: {
              [type.name]: (
                node: ProsemirrorNode,
                view: EditorView,
                getPos: boolean | (() => number)
              ) => new NodeViewClass(node, view, getPos as U),
            },
          },
          // view: () => ({
          //   update(view, oldState) {

          //   }
          // }),
        },
        spec
      )
    );
  }
}
