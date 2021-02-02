import { BlockRuleHandle } from "../../../editor";

import { HTML_OPEN_CLOSE_TAG_RE } from "./re";

// An array of opening and corresponding closing sequences for html tags,
// last argument defines whether it can terminate a paragraph or not
const HTML_SEQUENCES: [RegExp, RegExp, boolean][] = [
  [/^<(script|pre|style)(?=(\s|>|$))/i, /<\/(script|pre|style)>/i, true],
  [/^<!--/, /-->/, true],
  [/^<\?/, /\?>/, true],
  [/^<![A-Z]/, />/, true],
  [/^<!\[CDATA\[/, /\]\]>/, true],
  [new RegExp(`^</?([A-Za-z][A-Za-z0-9\\-]*)(?=(\\s|/?>|$))`, "i"), /^$/, true],
  [new RegExp(`${HTML_OPEN_CLOSE_TAG_RE.source}\\s*$`), /^$/, false],
];

const handle: BlockRuleHandle = function html(
  state,
  silent,
  startLine,
  endLine
) {
  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) {
    return false;
  }

  let pos = state.bMarks[startLine] + state.tShift[startLine];
  if (state.src.charCodeAt(pos) !== 0x3c /* < */) {
    return false;
  }

  let max = state.eMarks[startLine];
  let lineText = state.src.slice(pos, max);

  let i: number;
  for (i = 0; i < HTML_SEQUENCES.length; i++) {
    if (HTML_SEQUENCES[i][0].test(lineText)) {
      break;
    }
  }

  if (i === HTML_SEQUENCES.length) {
    return false;
  }

  if (silent) {
    // true if this sequence can be a terminator, false otherwise
    return HTML_SEQUENCES[i][2];
  }

  let nextLine = startLine + 1;

  // If we are here - we detected HTML block.
  // Let's roll down till block end.
  if (!HTML_SEQUENCES[i][1].test(lineText)) {
    for (; nextLine < endLine; nextLine++) {
      if (state.sCount[nextLine] < state.blkIndent) {
        break;
      }

      pos = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];
      lineText = state.src.slice(pos, max);

      if (HTML_SEQUENCES[i][1].test(lineText)) {
        if (lineText.length !== 0) {
          nextLine++;
        }
        break;
      }
    }
  }

  state.line = nextLine;

  const token = state.push(this.name, 0);
  token.content = state.getLines(startLine, nextLine, state.blkIndent, true);

  return true;
};

export default handle;
