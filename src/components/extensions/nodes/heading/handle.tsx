import { BlockRuleHandle, isSpace } from "../../../editor";

// heading (# , ## , ...)
const handle: BlockRuleHandle = function heading(state, silent, startLine) {
  const start = state.bMarks[startLine];
  const end = state.eMarks[startLine];

  let pos = start + state.tShift[startLine];
  let max = end;

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) {
    return false;
  }

  let ch = state.src.charCodeAt(pos);

  if (ch !== 0x23 /* # */ || pos >= max) {
    return false;
  }

  // count heading level
  let level = 1;
  ch = state.src.charCodeAt(++pos);
  while (ch === 0x23 /* # */ && pos < max && level <= 6) {
    level++;
    ch = state.src.charCodeAt(++pos);
  }

  if (level > 6 || (pos < max && !isSpace(ch))) {
    return false;
  }

  if (silent) {
    return true;
  }

  // Let's cut tails like '    ###  ' from the end of string
  max = state.skipSpacesBack(max, pos);
  const tmp = state.skipCharsBack(max, 0x23, pos); // #
  if (tmp > pos && isSpace(state.src.charCodeAt(tmp - 1))) {
    max = tmp;
  }

  state.line = startLine + 1;

  state.push(this.name, 1, { level });
  state.push("markup", 0).content = state.src.slice(start, pos);

  const inlineToken = state.push("", 0);
  inlineToken.content = state.src.slice(pos, max); // TODO: .trim();
  inlineToken.children = [];

  state.push("markup", 0).content = state.src.slice(max, end);
  state.push(this.name, -1);

  return true;
};

export default handle;
