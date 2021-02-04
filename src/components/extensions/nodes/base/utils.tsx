import { Fragment, Node as ProsemirrorNode } from "prosemirror-model";

export function textBetween(
  node: ProsemirrorNode | Fragment,
  from: number,
  to: number,
  nodeStart = 0
) {
  let texts: string[] = [];

  for (let i = 0, pos = 0; pos < to; i++) {
    const child = node.child(i);
    const end = pos + child.nodeSize;
    if (end > from) {
      if (child.isText && child.text) {
        texts.push(child.text.slice(from, to));
      } else if (child.isBlock && !child.content.size) {
        texts.push("");
      } else if (child.content.size) {
        const start = pos + 1;
        texts.push(
          textBetween(
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

  const isTextBlock = node instanceof ProsemirrorNode && node.isTextblock;
  return texts.join(isTextBlock ? "" : "\n");
}
