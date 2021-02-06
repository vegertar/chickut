import { BlockRuleHandle, expandTab, isSpace } from "../../../editor";

type BlockState = Parameters<BlockRuleHandle>[0];

class Context {
  private pos = 0;
  private max = 0;
  private lastLineEmpty = false;

  readonly bMarks: number[] = [];
  readonly bsCount: number[] = [];
  readonly sCount: number[] = [];
  readonly tShift: number[] = [];
  readonly lineMax: number;
  readonly parent: string;

  constructor(
    readonly state: BlockState,
    readonly startLine: number,
    readonly endLine: number
  ) {
    this.lineMax = this.state.lineMax;
    this.parent = this.state.parent;
  }

  private insideBlockquote(line: number) {
    let initial: number;
    let offset: number;

    // set offset past spaces and ">"
    initial = offset = this.state.sCount[line] + 1;

    let adjustTab = false;
    let spaceAfterMarker = false;

    // skip one optional space after '>'
    if (this.state.src.charCodeAt(this.pos) === 0x20 /* space */) {
      // ' >   test '
      //     ^ -- position start of line here:
      this.pos++;
      initial++;
      offset++;
      adjustTab = false;
      spaceAfterMarker = true;
    } else if (this.state.src.charCodeAt(this.pos) === 0x09 /* tab */) {
      spaceAfterMarker = true;

      if (expandTab(this.state.bsCount[line] + offset) === 1) {
        // '  >\t  test '
        //       ^ -- position start of line here (tab has width===1)
        this.pos++;
        initial++;
        offset++;
        adjustTab = false;
      } else {
        // ' >\t  test '
        //    ^ -- position start of line here + shift bsCount slightly
        //         to make extra space appear
        adjustTab = true;
      }
    }

    this.bMarks.push(this.state.bMarks[line]);
    this.state.bMarks[line] = this.pos;

    while (this.pos < this.max) {
      const ch = this.state.src.charCodeAt(this.pos);
      if (!isSpace(ch)) {
        break;
      }

      if (ch === 0x09) {
        offset += expandTab(
          offset + this.state.bsCount[line] + (adjustTab ? 1 : 0)
        );
      } else {
        offset++;
      }

      this.pos++;
    }

    this.bsCount.push(this.state.bsCount[line]);
    this.state.bsCount[line] =
      this.state.sCount[line] + 1 + (spaceAfterMarker ? 1 : 0);

    this.sCount.push(this.state.sCount[line]);
    this.state.sCount[line] = offset - initial;

    this.tShift.push(this.state.tShift[line]);
    this.state.tShift[line] = this.pos - this.state.bMarks[line];

    this.lastLineEmpty = this.pos >= this.max;
  }

  init(silent: boolean) {
    // if it's indented more than 3 spaces, it should be a code block
    if (this.state.sCount[this.startLine] - this.state.blkIndent >= 4) {
      return -1;
    }

    this.pos =
      this.state.bMarks[this.startLine] + this.state.tShift[this.startLine];

    // check the block quote marker
    if (this.state.src.charCodeAt(this.pos++) !== 0x3e /* > */) {
      return -1;
    }

    // we know that it's going to be a valid blockquote,
    // so no point trying to find the end of it in silent mode
    if (silent) {
      return 0;
    }

    this.max = this.state.eMarks[this.startLine];
    this.insideBlockquote(this.startLine);
    return 1;
  }

  parse(name: string) {
    // Search the end of the block
    //
    // Block ends with either:
    //  1. an empty line outside:
    //     ```
    //     > test
    //
    //     ```
    //  2. an empty line inside:
    //     ```
    //     >
    //     test
    //     ```
    //  3. another tag:
    //     ```
    //     > test
    //      - - -
    //     ```
    this.state.parent = name;
    const terminatorRules = this.state.engine.block.ruler.getRules(name);

    let nextLine: number;
    for (nextLine = this.startLine + 1; nextLine < this.endLine; nextLine++) {
      // check if it's outdented, i.e. it's inside list item and indented
      // less than said list item:
      //
      // ```
      // 1. anything
      //    > current blockquote
      // 2. checking this line
      // ```
      const isOutdented = this.state.sCount[nextLine] < this.state.blkIndent;

      this.pos = this.state.bMarks[nextLine] + this.state.tShift[nextLine];
      this.max = this.state.eMarks[nextLine];

      if (this.pos >= this.max) {
        // Case 1: line is not inside the blockquote, and this line is empty.
        break;
      }

      if (
        this.state.src.charCodeAt(this.pos++) === 0x3e /* > */ &&
        !isOutdented
      ) {
        // This line is inside the blockquote.
        this.insideBlockquote(nextLine);
        continue;
      }

      // Case 2: line is not inside the blockquote, and the last line was empty.
      if (this.lastLineEmpty) {
        break;
      }

      // Case 3: another tag found.
      let terminate = false;
      for (const rule of terminatorRules) {
        if (rule(this.state, true, nextLine, this.endLine)) {
          terminate = true;
          break;
        }
      }

      if (terminate) {
        // Quirk to enforce "hard termination mode" for paragraphs;
        // normally if you call `tokenize(state, startLine, nextLine)`,
        // paragraphs will look below nextLine for paragraph continuation,
        // but if blockquote is terminated by another tag, they shouldn't
        this.state.lineMax = nextLine;

        if (this.state.blkIndent !== 0) {
          // state.blkIndent was non-zero, we now set it to zero,
          // so we need to re-calculate all offsets to appear as
          // if indent wasn't changed
          this.bMarks.push(this.state.bMarks[nextLine]);
          this.bsCount.push(this.state.bsCount[nextLine]);
          this.tShift.push(this.state.tShift[nextLine]);
          this.sCount.push(this.state.sCount[nextLine]);
          this.state.sCount[nextLine] -= this.state.blkIndent;
        }

        break;
      }

      this.bMarks.push(this.state.bMarks[nextLine]);
      this.bsCount.push(this.state.bsCount[nextLine]);
      this.tShift.push(this.state.tShift[nextLine]);
      this.sCount.push(this.state.sCount[nextLine]);

      // A negative indentation means that this is a paragraph continuation
      this.state.sCount[nextLine] = -1;
    }

    return nextLine;
  }
}

// block quote: "> "
const handle: BlockRuleHandle = function blockquote(
  state,
  silent,
  startLine,
  endLine
) {
  const context = new Context(state, startLine, endLine);
  switch (context.init(silent)) {
    case -1: // not a blockquote
      return false;
    case 0: // silent
      return true;
  }

  const nextLine = context.parse(this.name);
  const oldIndent = state.blkIndent;
  state.blkIndent = 0;

  const markup = state.src.slice(
    state.eMarks[startLine - 1] + 1,
    state.bMarks[startLine]
  );

  state.push(this.name, 1, { markupPosition: 1 });
  const openMarkup = state.push("markup", 0);
  const i = state.tokens.length;

  state.engine.block.tokenize(state, startLine, nextLine);
  if (!state.tokens[i] || state.tokens[i].name !== this.name) {
    openMarkup.content = markup;
  }

  state.push(this.name, -1);

  state.lineMax = context.lineMax;
  state.parent = context.parent;

  // Restore original tShift; this might not be necessary since the parser
  // has already been here, but just to make sure we can do that.
  for (let i = 0; i < context.tShift.length; i++) {
    state.bMarks[i + startLine] = context.bMarks[i];
    state.tShift[i + startLine] = context.tShift[i];
    state.sCount[i + startLine] = context.sCount[i];
    state.bsCount[i + startLine] = context.bsCount[i];
  }
  state.blkIndent = oldIndent;

  return true;
};

export default handle;
