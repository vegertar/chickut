import { Fragment, Node as ProsemirrorNode } from "prosemirror-model";

import { trimSplit, RuleMarkSpec, RuleNodeSpec } from "../../../editor";

export function nodeToText(
  node: ProsemirrorNode | Fragment,
  from: number,
  to: number,
  nodeStart = 0
) {
  const texts: string[] = [];

  for (let i = 0, pos = 0; pos < to; i++) {
    const child = node.child(i);
    const end = pos + child.nodeSize;

    if (end > from) {
      if (child.isText && child.text) {
        const start = nodeStart + pos;
        const s = child.text.slice(
          Math.max(from, start) - start,
          Math.min(child.text.length, to)
        );
        texts.push(
          child.marks.reduce((s, mark) => {
            const toText = (mark.type.spec as RuleMarkSpec).toText;
            if (!toText) {
              return s;
            }
            const [left, x, right] = trimSplit(s);
            return `${left}${toText({ ...mark, text: x })}${right}`;
          }, s)
        );
      } else if (child.content.size) {
        const start = pos + 1;
        if (texts.length) {
          texts.push("\n");
        }
        texts.push(
          nodeToText(
            child,
            Math.max(0, from - start),
            Math.min(child.content.size, to - start),
            nodeStart + start
          )
        );
      }
    }

    pos = end;
  }

  const text = texts.join("");
  if (node instanceof ProsemirrorNode) {
    const toText = (node.type.spec as RuleNodeSpec<any>).toText;
    return toText ? toText({ ...node, text }) : text;
  }

  return text;
}

export function resolvePos(doc: ProsemirrorNode, from: number, to: number) {
  const $from = doc.resolve(from);
  return doc.resolve($from.start($from.sharedDepth(to)));
}
