import { useEffect } from "react";
import {
  DOMOutputSpec,
  Node as ProsemirrorNode,
  NodeSpec,
  NodeType,
} from "prosemirror-model";
import {
  Plugin,
  PluginKey,
  TextSelection,
  EditorState,
  Transaction,
} from "prosemirror-state";
import { EditorView } from "prosemirror-view";
// import { textblockTypeInputRule } from "prosemirror-inputrules";
import { findWrapping, canJoin } from "prosemirror-transform";
// import { inputRules } from "prosemirror-inputrules";
import range from "lodash.range";

import { useExtension } from "../../../editor";

import "./style.scss";

type Props = {
  text?: string;
};

export default function Heading({ text }: Props = {}) {
  const { dispatch, editorView, extensionName } = useExtension(Heading);
  const type = editorView?.state.schema.nodes[extensionName!];
  // console.log(">>>>", type?.create());
  const tr = editorView?.state.tr;

  if (type && tr) {
  }

  useEffect(() => {
    console.log(">>>", text);
  }, [dispatch, text]);

  return null;
}

Heading.node = {
  attrs: {
    level: {
      default: 1,
    },
  },
  content: "inline*",
  group: "block",
  defining: true,
  draggable: false,
  parseDOM: range(1, 7).map((level) => ({
    tag: `h${level}`,
    attrs: { level },
  })),
  toDOM: (node: ProsemirrorNode): DOMOutputSpec => [`h${node.attrs.level}`, 0],
};

Heading.rule = {
  match: /^ {0,3}(#{1,6}) +([^\n]*?)(?: +#+)? *(?:\n+|$)/,
  tag: (matched: string[]) => `h${matched[1].length}`,
  markup: (matched: string[]) => matched[1],
  content: (matched: string[]) => matched[2],
};

// Heading.plugins = (type: NodeType) => [
//   inputRules(
//     textblockTypeInputRule(
//       new RegExp(`^(#{${minLevel},${maxLevel}})\\s`),
//       type,
//       (match) => ({ level: match[1].length })
//     )
//   ),
// ];

// // ::- Input rules are regular expressions describing a piece of text
// // that, when typed, causes something to happen. This might be
// // changing two dashes into an emdash, wrapping a paragraph starting
// // with `"> "` into a blockquote, or something entirely different.
// export class InputRule {
//   // Create an input rule. The rule applies when the user typed
//   // something and the text directly in front of the cursor matches
//   // `match`, which should end with `$`.
//   //
//   // The `handler` can be a string, in which case the matched text, or
//   // the first matched group in the regexp, is replaced by that
//   // string.
//   //
//   // Or a it can be a function, which will be called with the match
//   // array produced by
//   // [`RegExp.exec`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec),
//   // as well as the start and end of the matched range, and which can
//   // return a [transaction](#state.Transaction) that describes the
//   // rule's effect, or null to indicate the input was not handled.

//   readonly match: RegExp;
//   readonly handler: ReturnType<typeof stringHandler>;

//   constructor(match: RegExp, handler: string | InputRule["handler"]) {
//     this.match = match;
//     this.handler =
//       typeof handler == "string" ? stringHandler(handler) : handler;
//   }
// }

// function stringHandler(string: string) {
//   return function (
//     state: EditorState,
//     match: string[],
//     start: number,
//     end: number
//   ): Transaction | null {
//     let insert = string;
//     if (match[1]) {
//       let offset = match[0].lastIndexOf(match[1]);
//       insert += match[0].slice(offset + match[1].length);
//       start += offset;
//       let cutOff = start - end;
//       if (cutOff > 0) {
//         insert = match[0].slice(offset - cutOff, offset) + insert;
//         start = end;
//       }
//     }
//     return state.tr.insertText(insert, start, end);
//   };
// }

// const MAX_MATCH = 500;

// export function inputRules(...rules: InputRule[]) {
//   const plugin: Plugin = new Plugin({
//     key: new PluginKey("heading"),
//     state: {
//       init() {
//         return null;
//       },
//       apply(tr, prev) {
//         const stored = tr.getMeta(this);
//         if (stored) {
//           return stored;
//         }
//         return tr.selectionSet || tr.docChanged ? null : prev;
//       },
//     },

//     props: {
//       transformPastedText(text, plain) {
//         console.log(text, plain);
//         return text;
//       },
//       clipboardTextParser(text, $context, plain) {
//         console.log(text, $context, plain);
//         return null as any;
//       },
//       handlePaste(view, event, slice) {
//         console.log(view, event, slice);
//         return false;
//       },
//       handleTextInput(view, from, to, text) {
//         // console.log(">>>>", text);
//         // return false;
//         return run(view, from, to, text, rules, plugin);
//       },
//       handleDOMEvents: {
//         compositionend: (view) => {
//           setTimeout(() => {
//             const { $cursor } = view.state.selection as TextSelection;
//             $cursor && run(view, $cursor.pos, $cursor.pos, "", rules, plugin);
//           });
//           return false;
//         },
//       },
//     },

//     // isInputRules: true,
//   });
//   return plugin;
// }

// function run(
//   view: EditorView,
//   from: number,
//   to: number,
//   text: string,
//   rules: InputRule[],
//   plugin: Plugin
// ) {
//   if (view.composing) {
//     return false;
//   }

//   const state = view.state;
//   const $from = state.doc.resolve(from);
//   if ($from.parent.type.spec.code) {
//     return false;
//   }

//   const textBefore =
//     $from.parent.textBetween(
//       Math.max(0, $from.parentOffset - MAX_MATCH),
//       $from.parentOffset,
//       undefined,
//       "\ufffc"
//     ) + text;

//   for (const rule of rules) {
//     const match = rule.match.exec(textBefore);
//     const tr =
//       match &&
//       rule.handler(state, match, from - (match[0].length - text.length), to);
//     if (!tr) {
//       continue;
//     }

//     view.dispatch(tr.setMeta(plugin, { transform: tr, from, to, text }));
//     return true;
//   }

//   return false;
// }

// type AttrsGetter =
//   | Record<string, any>
//   | ((p: string[]) => Record<string, any> | undefined);

// // // :: (EditorState, ?(Transaction)) → bool
// // // This is a command that will undo an input rule, if applying such a
// // // rule was the last thing that the user did.
// // export function undoInputRule(state: EditorState, dispatch) {
// //   let plugins = state.plugins
// //   for (let i = 0; i < plugins.length; i++) {
// //     let plugin = plugins[i], undoable
// //     if (plugin.spec.isInputRules && (undoable = plugin.getState(state))) {
// //       if (dispatch) {
// //         let tr = state.tr, toUndo = undoable.transform
// //         for (let j = toUndo.steps.length - 1; j >= 0; j--)
// //           tr.step(toUndo.steps[j].invert(toUndo.docs[j]))
// //         if (undoable.text) {
// //           let marks = tr.doc.resolve(undoable.from).marks()
// //           tr.replaceWith(undoable.from, undoable.to, state.schema.text(undoable.text, marks))
// //         } else {
// //           tr.delete(undoable.from, undoable.to)
// //         }
// //         dispatch(tr)
// //       }
// //       return true
// //     }
// //   }
// //   return false
// // }

// // :: (RegExp, NodeType, ?union<Object, ([string]) → ?Object>, ?([string], Node) → bool) → InputRule
// // Build an input rule for automatically wrapping a textblock when a
// // given string is typed. The `regexp` argument is
// // directly passed through to the `InputRule` constructor. You'll
// // probably want the regexp to start with `^`, so that the pattern can
// // only occur at the start of a textblock.
// //
// // `nodeType` is the type of node to wrap in. If it needs attributes,
// // you can either pass them directly, or pass a function that will
// // compute them from the regular expression match.
// //
// // By default, if there's a node with the same type above the newly
// // wrapped node, the rule will try to [join](#transform.Transform.join) those
// // two nodes. You can pass a join predicate, which takes a regular
// // expression match and the node before the wrapped node, and can
// // return a boolean to indicate whether a join should happen.
// export function wrappingInputRule(
//   regexp: RegExp,
//   nodeType: NodeType,
//   getAttrs?: AttrsGetter,
//   joinPredicate?: (p1: string[], p2: ProsemirrorNode) => boolean
// ) {
//   return new InputRule(
//     regexp,
//     (state: EditorState, match: string[], start: number, end: number) => {
//       let attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs;
//       let tr = state.tr.delete(start, end);
//       let $start = tr.doc.resolve(start),
//         range = $start.blockRange(),
//         wrapping = range && findWrapping(range, nodeType, attrs);
//       if (!wrapping) return null;
//       tr.wrap(range!, wrapping);
//       let before = tr.doc.resolve(start - 1).nodeBefore;
//       if (
//         before &&
//         before.type === nodeType &&
//         canJoin(tr.doc, start - 1) &&
//         (!joinPredicate || joinPredicate(match, before))
//       )
//         tr.join(start - 1);
//       return tr;
//     }
//   );
// }

// // :: (RegExp, NodeType, ?union<Object, ([string]) → ?Object>) → InputRule
// // Build an input rule that changes the type of a textblock when the
// // matched text is typed into it. You'll usually want to start your
// // regexp with `^` to that it is only matched at the start of a
// // textblock. The optional `getAttrs` parameter can be used to compute
// // the new node's attributes, and works the same as in the
// // `wrappingInputRule` function.
// export function textblockTypeInputRule(
//   regexp: RegExp,
//   nodeType: NodeType,
//   getAttrs?: AttrsGetter
// ) {
//   return new InputRule(regexp, (state, match, start, end) => {
//     const $start = state.doc.resolve(start);
//     const attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs;
//     if (
//       !$start
//         .node(-1)
//         .canReplaceWith($start.index(-1), $start.indexAfter(-1), nodeType)
//     )
//       return null;
//     return state.tr
//       .delete(start, end)
//       .setBlockType(start, start, nodeType, attrs);
//   });
// }
