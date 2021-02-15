import {
  BlockRuleHandle,
  Env,
  expandTab,
  isSpace,
  StateEnv,
} from "../../../editor";

import names from "./names";

type BlockState = Parameters<BlockRuleHandle>[0];

type ListStateEnv = StateEnv & {
  listIndent?: number;
};

// Search `[-+*][\n ]`, returns next pos after marker on success or -1 on fail.
function skipBulletListMarker(state: BlockState, startLine: number) {
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

  if (pos < state.eMarks[startLine] && !isSpace(state.src.charCodeAt(pos))) {
    // " -test " - is not a list item
    return -1;
  }

  return pos;
}

// Search `\d+[.)][\n ]`, returns next pos after marker on success or -1 on fail.
function skipOrderedListMarker(state: BlockState, startLine: number) {
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
      // List marker should have no more than 9 digits (prevents integer overflow in browsers)
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

  if (pos < max && !isSpace(state.src.charCodeAt(pos))) {
    // " 1.test " - is not a list item
    return -1;
  }

  return pos;
}

function markTightParagraphs(state: BlockState, idx: number) {
  const level = state.level + 2;
  for (let i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
    const token = state.tokens[i];
    if (token.level === level && token.name === "paragraph") {
      if (!token.attrs) {
        token.attrs = {};
      }
      token.attrs.tight = true;
      i += 2;
    }
  }
}

const handle: BlockRuleHandle<Env, ListStateEnv> = function list(
  state,
  silent,
  startLine,
  endLine
) {
  let tight = true;

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) {
    return false;
  }

  const { listIndent = -1 } = state.local;

  // Special case:
  //  - item 1
  //   - item 2
  //    - item 3
  //     - item 4
  //      - this one is a paragraph continuation
  if (
    listIndent !== undefined &&
    state.sCount[startLine] - listIndent >= 4 &&
    state.sCount[startLine] < state.blkIndent
  ) {
    return false;
  }

  let isTerminatingParagraph = false;

  // limit conditions when list can interrupt
  // a paragraph (validation mode only)
  if (silent && state.parent === "paragraph") {
    // Next list item should still terminate previous list item;
    // This code can fail if plugins use blkIndent as well as lists, but I hope the spec gets fixed long before that happens.
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

    // If we're starting a new ordered list right after a paragraph, it should start with 1.
    if (isTerminatingParagraph && markerValue !== 1) {
      return false;
    }
  } else if ((posAfterMarker = skipBulletListMarker(state, startLine)) >= 0) {
    isOrdered = false;
  } else {
    return false;
  }

  // If we're starting a new unordered list right after a paragraph, first line should not be empty.
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
  const listTokenIndex = state.tokens.length;
  const listName = isOrdered ? names.ordered : names.bulleted;

  const openToken = state.push(listName, 1);
  if (!isOrdered) {
    openToken.attrs = { marker: String.fromCharCode(markerCharCode) };
  } else if (markerValue !== 1) {
    openToken.attrs = { start: markerValue };
  }

  //
  // Iterate list items
  //

  let nextLine = startLine;
  let prevEmptyEnd = false;

  const terminatorRules = state.engine.block.ruler.getRules(this.name);
  const oldParent = state.parent;
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

      if (ch === 0x09 /* tab */) {
        offset += expandTab(offset + state.bsCount[nextLine]);
      } else if (ch === 0x20 /* space */) {
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

    // If we have more than 4 spaces, the indent is 1 (the rest is just indented code block)
    if (indentAfterMarker > 4) {
      indentAfterMarker = 1;
    }

    // "  -  test"
    //  ^^^^^ - calculating total length of this thing
    const indent = initial + indentAfterMarker;

    // Run subparser & write tokens
    state.push(names.item, 1);

    // change current state, then restore it after parser subcall
    const oldTight = state.tight;
    const oldTShift = state.tShift[startLine];
    const oldSCount = state.sCount[startLine];

    //  - example list
    // ^ listIndent position will be here
    //   ^ blkIndent position will be here
    //
    const { oldListIndent = -1 } = state.local;
    state.local.listIndent = state.blkIndent;
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
      // TODO: add a blank
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

    state.blkIndent = state.local.listIndent;
    state.local.listIndent = oldListIndent;
    state.tShift[startLine] = oldTShift;
    state.sCount[startLine] = oldSCount;
    state.tight = oldTight;

    state.push(names.item, -1);

    nextLine = startLine = state.line;
    if (nextLine >= endLine) {
      break;
    }

    // Try to check if list is terminated or continued.
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
    posAfterMarker = isOrdered
      ? skipOrderedListMarker(state, nextLine)
      : skipBulletListMarker(state, nextLine);
    if (
      posAfterMarker < 0 ||
      markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)
    ) {
      break;
    }
  }

  // Finalize list
  state.push(listName, -1);

  state.line = nextLine;
  state.parent = oldParent;

  // mark paragraphs tight if needed
  tight && markTightParagraphs(state, listTokenIndex);

  return true;
};

export default handle;
