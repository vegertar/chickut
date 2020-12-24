import { BlockRuleHandle, isSpace } from "../../../editor";

// heading (# , ## , ...)
const handle: BlockRuleHandle = function heading(state, silent, startLine) {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];

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

  if (state.env.typing && pos === max) {
    // The commonmark spec(so did the original markdown-it code) treats '#...' without tailing chars as the empty heading, i.e. the condition (pos < max) is legal, but which makes hard typing for different levels.
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

  const openToken = state.push(this.name, 1);
  openToken.markup = "#".repeat(level);
  openToken.map = [startLine, state.line];
  openToken.attrs = { level };

  const inlineToken = state.push("", 0);
  inlineToken.content = state.src.slice(pos, max).trim();
  inlineToken.map = [startLine, state.line];
  inlineToken.children = [];

  const closeToken = state.push(this.name, -1);
  closeToken.markup = openToken.markup;

  return true;
};

export default handle;
