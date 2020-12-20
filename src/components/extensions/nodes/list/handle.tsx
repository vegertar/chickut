import { BlockRuleHandle, BlockState, isSpace } from "../../../editor";

import item from "./item";
import bulleted from "./bulleted";
import numbered from "./numbered";

// Search `[-+*][\n ]`, returns next pos after marker on success
// or -1 on fail.
function skipBulletListMarker<T>(state: BlockState<T>, startLine: number) {
  const max = state.eMarks[startLine];
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  const marker = state.src.charCodeAt(pos++);

  // Check bullet
  if (
    marker !== 0x2a /* * */ &&
    marker !== 0x2d /* - */ &&
    marker !== 0x2b /* + */
  ) {
    return -1;
  }

  if (pos < max) {
    const ch = state.src.charCodeAt(pos);
    if (!isSpace(ch)) {
      // " -test " - is not a list item
      return -1;
    }
  }

  return pos;
}

// Search `\d+[.)][\n ]`, returns next pos after marker on success
// or -1 on fail.
function skipOrderedListMarker<T>(state: BlockState<T>, startLine: number) {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  let pos = start;

  // List marker should have at least 2 chars (digit + dot)
  if (pos + 1 >= max) {
    return -1;
  }

  let ch = state.src.charCodeAt(pos++);
  if (ch < 0x30 /* 0 */ || ch > 0x39 /* 9 */) {
    return -1;
  }

  for (;;) {
    // EOL -> fail
    if (pos >= max) {
      return -1;
    }

    ch = state.src.charCodeAt(pos++);

    if (ch >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */) {
      // List marker should have no more than 9 digits
      // (prevents integer overflow in browsers)
      if (pos - start >= 10) {
        return -1;
      }

      continue;
    }

    // found valid marker
    if (ch === 0x29 /* ) */ || ch === 0x2e /* . */) {
      break;
    }

    return -1;
  }

  if (pos < max) {
    ch = state.src.charCodeAt(pos);
    if (!isSpace(ch)) {
      // " 1.test " - is not a list item
      return -1;
    }
  }
  return pos;
}

function markTightParagraphs<T>(state: BlockState<T>, idx: number) {
  const level = state.level + 2;
  for (let i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
    if (
      state.tokens[i].level === level &&
      state.tokens[i].name === "paragraph"
    ) {
      state.tokens[i + 2].hidden = true;
      state.tokens[i].hidden = true;
      i += 2;
    }
  }
}

const handle: BlockRuleHandle = function (state, silent, startLine, endLine) {
  let tight = true;

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) {
    return false;
  }

  // Special case:
  //  - item 1
  //   - item 2
  //    - item 3
  //     - item 4
  //      - this one is a paragraph continuation
  if (
    state.listIndent >= 0 &&
    state.sCount[startLine] - state.listIndent >= 4 &&
    state.sCount[startLine] < state.blkIndent
  ) {
    return false;
  }

  let isTerminatingParagraph = false;

  // limit conditions when list can interrupt
  // a paragraph (validation mode only)
  if (silent && state.parent === "paragraph") {
    // TODO: xxx
    // Next list item should still terminate previous list item;
    //
    // This code can fail if plugins use blkIndent as well as lists,
    // but I hope the spec gets fixed long before that happens.
    //
    if (state.tShift[startLine] >= state.blkIndent) {
      isTerminatingParagraph = true;
    }
  }

  let posAfterMarker: number;
  let isOrdered: boolean;
  let markerValue: number | undefined;

  // Detect list type and position after marker
  if ((posAfterMarker = skipOrderedListMarker(state, startLine)) >= 0) {
    isOrdered = true;
    const start = state.bMarks[startLine] + state.tShift[startLine];
    markerValue = Number(state.src.substr(start, posAfterMarker - start - 1));

    // If we're starting a new ordered list right after
    // a paragraph, it should start with 1.
    if (isTerminatingParagraph && markerValue !== 1) {
      return false;
    }
  } else if ((posAfterMarker = skipBulletListMarker(state, startLine)) >= 0) {
    isOrdered = false;
  } else {
    return false;
  }

  // If we're starting a new unordered list right after
  // a paragraph, first line should not be empty.
  if (
    isTerminatingParagraph &&
    state.skipSpaces(posAfterMarker) >= state.eMarks[startLine]
  ) {
    return false;
  }

  // We should terminate list on style change. Remember first one to compare.
  const markerCharCode = state.src.charCodeAt(posAfterMarker - 1);

  // For validation mode we can terminate immediately
  if (silent) {
    return true;
  }

  // Start list
  const listTokIdx = state.tokens.length;

  const openToken = state.push(isOrdered ? numbered.name : bulleted.name, 1);
  if (isOrdered && markerValue !== 1) {
    openToken.attrs = { start: markerValue };
  }
  openToken.map = [startLine, 0];
  openToken.markup = String.fromCharCode(markerCharCode);

  const listLines = openToken.map;

  //
  // Iterate list items
  //

  let nextLine = startLine;
  let prevEmptyEnd = false;

  const terminatorRules = state.engine.block.ruler.getRules(this.name);
  const oldParentType = state.parent;
  state.parent = this.name;

  while (nextLine < endLine) {
    let pos = posAfterMarker;
    const max = state.eMarks[nextLine];

    let offset =
      state.sCount[nextLine] +
      posAfterMarker -
      (state.bMarks[startLine] + state.tShift[startLine]);
    const initial = offset;

    while (pos < max) {
      const ch = state.src.charCodeAt(pos);

      if (ch === 0x09) {
        offset += 4 - ((offset + state.bsCount[nextLine]) % 4);
      } else if (ch === 0x20) {
        offset++;
      } else {
        break;
      }

      pos++;
    }

    let contentStart = pos;
    let indentAfterMarker: number;

    if (contentStart >= max) {
      // trimming space in "-    \n  3" case, indent is 1 here
      indentAfterMarker = 1;
    } else {
      indentAfterMarker = offset - initial;
    }

    // If we have more than 4 spaces, the indent is 1
    // (the rest is just indented code block)
    if (indentAfterMarker > 4) {
      indentAfterMarker = 1;
    }

    // "  -  test"
    //  ^^^^^ - calculating total length of this thing
    const indent = initial + indentAfterMarker;

    // Run subparser & write tokens
    const openToken = state.push(item.name, 1);
    openToken.markup = String.fromCharCode(markerCharCode);
    openToken.map = [startLine, 0];

    const itemLines = openToken.map;

    // change current state, then restore it after parser subcall
    const oldTight = state.tight;
    const oldTShift = state.tShift[startLine];
    const oldSCount = state.sCount[startLine];

    //  - example list
    // ^ listIndent position will be here
    //   ^ blkIndent position will be here
    //
    const oldListIndent = state.listIndent;
    state.listIndent = state.blkIndent;
    state.blkIndent = indent;

    state.tight = true;
    state.tShift[startLine] = contentStart - state.bMarks[startLine];
    state.sCount[startLine] = offset;

    if (contentStart >= max && state.isEmpty(startLine + 1)) {
      // workaround for this case
      // (list item is empty, list terminates before "foo"):
      // ~~~~~~~~
      //   -
      //
      //     foo
      // ~~~~~~~~
      state.line = Math.min(state.line + 2, endLine);
    } else {
      state.engine.block.tokenize(state, startLine, endLine);
    }

    // If any of list item is tight, mark list as tight
    if (!state.tight || prevEmptyEnd) {
      tight = false;
    }
    // Item become loose if finish with empty line,
    // but we should filter last element, because it means list finish
    prevEmptyEnd = state.line - startLine > 1 && state.isEmpty(state.line - 1);

    state.blkIndent = state.listIndent;
    state.listIndent = oldListIndent;
    state.tShift[startLine] = oldTShift;
    state.sCount[startLine] = oldSCount;
    state.tight = oldTight;

    const closeToken = state.push(item.name, -1);
    closeToken.markup = String.fromCharCode(markerCharCode);

    nextLine = startLine = state.line;
    itemLines[1] = nextLine;
    contentStart = state.bMarks[startLine];

    if (nextLine >= endLine) {
      break;
    }

    //
    // Try to check if list is terminated or continued.
    //
    if (state.sCount[nextLine] < state.blkIndent) {
      break;
    }

    // if it's indented more than 3 spaces, it should be a code block
    if (state.sCount[startLine] - state.blkIndent >= 4) {
      break;
    }

    // fail if terminating block found
    let terminate = false;
    for (const rule of terminatorRules) {
      if (rule(state, true, nextLine, endLine)) {
        terminate = true;
        break;
      }
    }
    if (terminate) {
      break;
    }

    // fail if list has another type
    if (isOrdered) {
      posAfterMarker = skipOrderedListMarker(state, nextLine);
      if (posAfterMarker < 0) {
        break;
      }
    } else {
      posAfterMarker = skipBulletListMarker(state, nextLine);
      if (posAfterMarker < 0) {
        break;
      }
    }

    if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) {
      break;
    }
  }

  // Finalize list
  const closeToken = state.push(isOrdered ? numbered.name : bulleted.name, -1);
  closeToken.markup = String.fromCharCode(markerCharCode);

  listLines[1] = nextLine;
  state.line = nextLine;

  state.parent = oldParentType;

  // mark paragraphs tight if needed
  if (tight) {
    markTightParagraphs(state, listTokIdx);
  }

  return true;
};

export default handle;
