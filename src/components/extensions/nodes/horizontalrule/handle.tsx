import { BlockRuleHandle, isSpace } from "../../../editor";

const handle: BlockRuleHandle = function (state, silent, startLine) {
  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) {
    return false;
  }

  const start = state.bMarks[startLine];
  let pos = start + state.tShift[startLine];
  const marker = state.src.charCodeAt(pos++);

  // Check hr marker
  if (
    marker !== 0x2a /* * */ &&
    marker !== 0x2d /* - */ &&
    marker !== 0x5f /* _ */
  ) {
    return false;
  }

  // markers can be mixed with spaces, but there should be at least 3 of them

  let cnt = 1;
  const max = state.eMarks[startLine];
  while (pos < max) {
    const ch = state.src.charCodeAt(pos++);
    if (ch !== marker && !isSpace(ch)) {
      return false;
    }
    if (ch === marker) {
      cnt++;
    }
  }

  if (cnt < 3) {
    return false;
  }

  if (silent) {
    return true;
  }

  state.line = startLine + 1;

  const token = state.push(this.name, 0, { markupPosition: 1 });
  // token.markup = state.src.slice(start, pos);

  return true;
};

export default handle;
