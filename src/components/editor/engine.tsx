// Text engine pruning from markdown-it

import { Transaction } from "prosemirror-state";
import merge from "lodash.merge";

import { ExtensionSchema } from "./types";

export class NoParserError extends Error {}

export interface Options {
  maxNesting: number;
  ignoreError: boolean;
}

export interface Env {
  tr: Transaction<ExtensionSchema>;
  typing?: boolean;
  [key: string]: any;
}

export function isSpace(code: number) {
  switch (code) {
    case 0x09:
    case 0x20:
      return true;
  }
  return false;
}

export function isWhiteSpace(code: number) {
  if (code >= 0x2000 && code <= 0x200a) {
    return true;
  }
  switch (code) {
    case 0x09: // \t
    case 0x0a: // \n
    case 0x0b: // \v
    case 0x0c: // \f
    case 0x0d: // \r
    case 0x20:
    case 0xa0:
    case 0x1680:
    case 0x202f:
    case 0x205f:
    case 0x3000:
      return true;
  }
  return false;
}

// from 'uc.micro/categories/P/regex';
const UNICODE_PUNCT_RE = /[!-#%-*,-/:;?@[-\]_{}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4E\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDF55-\uDF59]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDF3C-\uDF3E]|\uD806[\uDC3B\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8]|\uD809[\uDC70-\uDC74]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDE97-\uDE9A]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/;

export function isPunctChar(ch: string) {
  return UNICODE_PUNCT_RE.test(ch);
}

// Markdown ASCII punctuation characters.
//
// !, ", #, $, %, &, ', (, ), *, +, ,, -, ., /, :, ;, <, =, >, ?, @, [, \, ], ^, _, `, {, |, }, or ~
// http://spec.commonmark.org/0.15/#ascii-punctuation-character
//
// Don't confuse with unicode punctuation !!! It lacks some chars in ascii range.
//
const MD_ASCII_PUNCT_SET = new Set([
  0x21 /* ! */,
  0x22 /* " */,
  0x23 /* # */,
  0x24 /* $ */,
  0x25 /* % */,
  0x26 /* & */,
  0x27 /* ' */,
  0x28 /* ( */,
  0x29 /* ) */,
  0x2a /* * */,
  0x2b /* + */,
  0x2c /* , */,
  0x2d /* - */,
  0x2e /* . */,
  0x2f /* / */,
  0x3a /* : */,
  0x3b /* ; */,
  0x3c /* < */,
  0x3d /* = */,
  0x3e /* > */,
  0x3f /* ? */,
  0x40 /* @ */,
  0x5b /* [ */,
  0x5c /* \ */,
  0x5d /* ] */,
  0x5e /* ^ */,
  0x5f /* _ */,
  0x60 /* ` */,
  0x7b /* { */,
  0x7c /* | */,
  0x7d /* } */,
  0x7e /* ~ */,
]);
export function isMdAsciiPunct(ch: number) {
  return MD_ASCII_PUNCT_SET.has(ch);
}

export function isValidEntityCode(c: number) {
  /*eslint no-bitwise:0*/
  // broken sequence
  if (c >= 0xd800 && c <= 0xdfff) {
    return false;
  }
  // never used
  if (c >= 0xfdd0 && c <= 0xfdef) {
    return false;
  }
  if ((c & 0xffff) === 0xffff || (c & 0xffff) === 0xfffe) {
    return false;
  }
  // control codes
  if (c >= 0x00 && c <= 0x08) {
    return false;
  }
  if (c === 0x0b) {
    return false;
  }
  if (c >= 0x0e && c <= 0x1f) {
    return false;
  }
  if (c >= 0x7f && c <= 0x9f) {
    return false;
  }
  // out of range
  if (c > 0x10ffff) {
    return false;
  }
  return true;
}

export function fromCodePoint(c: number) {
  /*eslint no-bitwise:0*/
  if (c > 0xffff) {
    c -= 0x10000;
    var surrogate1 = 0xd800 + (c >> 10),
      surrogate2 = 0xdc00 + (c & 0x3ff);

    return String.fromCharCode(surrogate1, surrogate2);
  }
  return String.fromCharCode(c);
}

export function expandTab(n: number) {
  return 4 - (n % 4);
}

export function trimSplit(s: string) {
  let i = 0;
  while (i < s.length && isWhiteSpace(s.charCodeAt(i))) {
    ++i;
  }
  let j = s.length;
  while (j > i && isWhiteSpace(s.charCodeAt(j - 1))) {
    --j;
  }

  return [s.slice(0, i), s.slice(i, j), s.slice(j)];
}

const NEWLINES_RE = /\r\n?|\n/g;
const NULL_RE = /\0/g;

// 1: opening, 0: self closing, -1: clsoing
type Nesting = 1 | 0 | -1;

export class Token {
  // Token attributes, e.g. html attributes, heading level, fence info, etc.
  attrs?: Record<string, any>;
  // Source map info. Format: `[ line_begin, line_end ]`
  map?: [number, number];
  // nesting level, the same as `state.level`
  level?: number;
  // An array of child nodes, only available for block/inline token
  children?: Token[];
  // Text content of this tag.
  content?: string;
  // '*' or '_' for emphasis, fence string for fence, etc.
  markup?: string;
  // A place for plugins to store an arbitrary data
  meta?: Record<string, any>;
  // If it's true, ignore this element when rendering. Used for tight lists hide paragraphs.
  hidden = false;

  constructor(
    // There are two preserved name:
    //   "": the root of inline token, which contains actual inline children with name, e.g. "text", "link", etc.
    //   "text": the leaf inline token without marks.
    public name: string,
    // In case of root inline token or leaf text token, nesting is 0
    public nesting: Nesting
  ) {}
}

interface StateProps<T, P> {
  // the instance made up by parsers
  engine: T;
  // the input raw source code
  src: string;
  // the output parsed tokens
  tokens: Token[];
  // out-of-band properites
  env: P;
}

class State<T, P> {
  inlineMode = false;

  engine: T;
  src: string;
  tokens: Token[];
  env: P;

  constructor({ src, engine, tokens, env }: StateProps<T, P>) {
    this.src = src;
    this.engine = engine;
    this.tokens = tokens;
    this.env = env;
  }
}

export type Rule<H> = {
  name: string;
  handle: H;
  disabled?: boolean;
  alt?: string[];
};

type OmitThisArg<F, ThisT> = F extends (
  this: ThisT,
  ...args: infer P
) => infer R
  ? (...args: P) => R
  : never;

type Cache<H> = Record<string, OmitThisArg<H, Rule<H>>[]>;

export class Ruler<H extends Function> {
  private readonly rules: Rule<H>[] = [];
  private cache?: Cache<H>;

  constructor(...rules: Rule<H>[]) {
    this.add(...rules);
  }

  // Find rule index by name
  private find(name: string) {
    return this.rules.findIndex((item) => item.name === name);
  }

  // Build rules lookup cache
  private compile() {
    const chains = new Set<string>();
    chains.add("");

    this.rules.forEach(
      (rule) =>
        !rule.disabled &&
        rule.alt?.forEach((item) => chains.add(item === "." ? rule.name : item))
    );

    const cache: Cache<H> = {};

    chains.forEach((chain) => {
      cache[chain] = [];
      this.rules.forEach((rule) => {
        if (rule.disabled) {
          return;
        }

        if (
          !chain ||
          (rule.alt &&
            (rule.alt.indexOf(chain) !== -1 ||
              (rule.name === chain && rule.alt.indexOf(".") !== -1)))
        ) {
          cache[chain].push(rule.handle.bind(rule));
        }
      });
    });

    this.cache = cache;
    return this;
  }

  // Insert a new rule at the specific index.
  insert(rule: Rule<H>, index?: number) {
    if (index === undefined || index >= this.rules.length) {
      return this.add(rule);
    }

    this.rules.splice(index, 0, rule);
    this.cache = undefined;
    return this;
  }

  // Add new rules to the end of chain.
  add(...rules: Rule<H>[]) {
    if (rules.length) {
      this.rules.push(...rules);
      this.cache = undefined;
    }
    return this;
  }

  // Replace existing typographer replacement rule with new one.
  replace(rule: Rule<H>) {
    const index = this.find(rule.name);
    if (index === -1) {
      throw new Error("Parser rule not found: " + rule.name);
    }

    this.rules[index] = rule;
    this.cache = undefined;
    return this;
  }

  // Remove existed rules by given names.
  remove(...names: string[]) {
    for (const name of names) {
      const idx = this.find(name);
      if (idx !== -1) {
        this.rules.splice(idx, 1);
      }
    }
    this.cache = undefined;
    return this;
  }

  // Clean up all rules.
  clear() {
    this.rules.splice(0);
    this.cache = undefined;
    return this;
  }

  // Return array of active functions (rules) for given chain name. It analyzes rules configuration, compiles caches if not exists and returns result. Default chain name is `''` (empty string). It can't be skipped. That's done intentionally, to keep signature monomorphic for high speed.
  getRules(chainName = "") {
    if (this.cache === undefined) {
      this.compile();
    }

    // Chain can be empty, if rules disabled. But we still have to return Array.
    return this.cache?.[chainName] || [];
  }
}

abstract class Parser<T, P, H extends Function> {
  readonly ruler = new Ruler<H>();
  abstract parse(props: StateProps<T, P>): any;
}

type CoreHandle<T, P> = (
  this: Rule<CoreHandle<T, P>>,
  state: State<T, P>
) => void;

export class CoreState<T = {}, P = {}> extends State<T, P> {}

class CoreParser<T, P> extends Parser<T, P, CoreHandle<T, P>> {
  parse(props: StateProps<T, P>) {
    const state = new CoreState(props);
    this.ruler.getRules().forEach((rule) => rule(state));
  }
}

export class BlockState<T = {}, P = {}> extends State<T, P> {
  // The index of bMarks/eMarks/tShift/sCount/bsCount is the zero-based line number.
  // line begin offsets for fast jumps
  bMarks: number[] = [];
  // line end offsets for fast jumps, the index past last char
  eMarks: number[] = [];
  // offsets of the first non-space characters (tabs not expanded)
  tShift: number[] = [];
  // indents for each line (tabs expanded)
  sCount: number[] = [];
  // An amount of virtual spaces (tabs expanded) between beginning of each line (bMarks) and real beginning of that line.
  // It exists only as a hack because blockquotes override bMarks losing information in the process.
  // It's used only when expanding tabs, you can think about it as an initial tab length, e.g. bsCount=21 applied to string `\t123` means first tab should be expanded to 4-21%4 === 3 spaces.
  bsCount: number[] = [];
  // required block content indent (for example, if we are inside a list, it would be positioned after list marker)
  blkIndent = 0;
  // line index in src
  line = 0;
  // lines count
  lineMax = 0;
  // loose/tight mode for lists
  tight = false;
  // indent of the current dd block (-1 if there isn't any)
  ddIndent = -1;
  // indent of the current list block (-1 if there isn't any)
  listIndent = -1;
  // used in lists to determine if they interrupt a paragraph
  parent = "";
  // nesting level
  level = 0;

  constructor(props: StateProps<T, P>) {
    super(props);

    let indentFound = false;
    let start = 0;
    let indent = 0;
    let offset = 0;
    for (let pos = 0, len = this.src.length; pos < len; pos++) {
      const ch = this.src.charCodeAt(pos);

      if (!indentFound) {
        if (isSpace(ch)) {
          indent++;

          // '\t'
          if (ch === 0x09) {
            offset += expandTab(offset);
          } else {
            offset++;
          }
          continue;
        } else {
          indentFound = true;
        }
      }

      // meet '\n' or last
      if (ch === 0x0a || pos === len - 1) {
        if (ch !== 0x0a) {
          pos++;
        }
        this.bMarks.push(start);
        this.eMarks.push(pos);
        this.tShift.push(indent);
        this.sCount.push(offset);
        this.bsCount.push(0);

        // set a new line
        indentFound = false;
        indent = 0;
        offset = 0;
        start = pos + 1;
      }
    }

    // Push fake entry to simplify cache bounds checks
    this.bMarks.push(this.src.length);
    this.eMarks.push(this.src.length);
    this.tShift.push(0);
    this.sCount.push(0);
    this.bsCount.push(0);

    this.lineMax = this.bMarks.length - 1; // don't count last fake line
  }

  // Push new token to "stream".
  push(name: string, nesting: Nesting) {
    const token = new Token(name, nesting);

    // closing tag
    if (nesting < 0) {
      this.level--;
    }

    token.level = this.level;

    // opening tag
    if (nesting > 0) {
      this.level++;
    }

    this.tokens.push(token);
    return token;
  }

  isEmpty(line: number) {
    return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
  }

  skipEmptyLines(from: number) {
    for (let max = this.lineMax; from < max; from++) {
      if (!this.isEmpty(from)) {
        break;
      }
    }
    return from;
  }

  // Skip spaces from given position.
  skipSpaces(pos: number) {
    for (let max = this.src.length; pos < max; pos++) {
      if (!isSpace(this.src.charCodeAt(pos))) {
        break;
      }
    }
    return pos;
  }

  // Skip spaces from given position in reverse.
  skipSpacesBack(pos: number, min: number) {
    if (pos <= min) {
      return pos;
    }

    while (pos > min) {
      if (!isSpace(this.src.charCodeAt(--pos))) {
        return pos + 1;
      }
    }
    return pos;
  }

  // Skip char codes from given position
  skipChars(pos: number, code: number) {
    for (let max = this.src.length; pos < max; pos++) {
      if (this.src.charCodeAt(pos) !== code) {
        break;
      }
    }
    return pos;
  }

  // Skip char codes reverse from given position - 1
  skipCharsBack(pos: number, code: number, min: number) {
    if (pos <= min) {
      return pos;
    }

    while (pos > min) {
      if (code !== this.src.charCodeAt(--pos)) {
        return pos + 1;
      }
    }
    return pos;
  }

  // Cut lines range from source.
  getLines(begin: number, end: number, indent: number, keepLastLF?: boolean) {
    if (begin >= end) {
      return "";
    }

    const queue = new Array(end - begin);

    for (let i = 0, line = begin; line < end; line++, i++) {
      const lineStart = this.bMarks[line];
      let lineIndent = 0;
      let first = lineStart;
      let last: number;

      if (line + 1 < end || keepLastLF) {
        // No need for bounds check because we have fake entry on tail.
        last = this.eMarks[line] + 1;
      } else {
        last = this.eMarks[line];
      }

      while (first < last && lineIndent < indent) {
        const ch = this.src.charCodeAt(first);

        if (isSpace(ch)) {
          // '\t'
          if (ch === 0x09) {
            lineIndent += expandTab(lineIndent + this.bsCount[line]);
          } else {
            lineIndent++;
          }
        } else if (first < lineStart + this.tShift[line]) {
          // patched tShift masked characters to look like spaces (blockquotes, list markers)
          lineIndent++;
        } else {
          break;
        }

        first++;
      }

      if (lineIndent > indent) {
        // partially expanding tabs in code blocks, e.g '\t\tfoobar'
        // with indent=2 becomes '  \tfoobar'
        queue[i] =
          " ".repeat(lineIndent - indent) + this.src.slice(first, last);
      } else {
        queue[i] = this.src.slice(first, last);
      }
    }

    return queue.join("");
  }
}

type BlockHandle<T, P> = (
  this: Rule<BlockHandle<T, P>>,
  state: BlockState<T, P>,

  // silent (validation) mode used to check if markup can terminate previous block without empty line. That's used as look-ahead, to detect block end. see: https://github.com/markdown-it/markdown-it/issues/323#issuecomment-271629253
  silent: boolean,

  startLine: number,
  endLine: number
) => boolean;

class BlockParser<T extends { options: Options }, P> extends Parser<
  T,
  P,
  BlockHandle<T, P>
> {
  parse(props: StateProps<T, P>) {
    if (!props.src) {
      return;
    }

    const state = new BlockState<T, P>(props);
    this.tokenize(state, state.line, state.lineMax);
  }

  tokenize(state: BlockState<T, P>, startLine: number, endLine: number) {
    const rules = this.ruler.getRules();
    const { maxNesting, ignoreError } = state.engine.options;
    let line = startLine;
    let hasEmptyLines = false;

    while (line < endLine) {
      state.line = line = state.skipEmptyLines(line);
      if (line >= endLine) {
        break;
      }

      // Termination condition for nested calls.
      // Nested calls currently used for blockquotes & lists
      if (state.sCount[line] < state.blkIndent) {
        break;
      }

      // If nesting level exceeded - skip tail to the end. That's not ordinary
      // situation and we should not care about content.
      if (state.level >= maxNesting) {
        state.line = endLine;
        break;
      }

      const lineBefore = line;

      // Try all possible rules.
      // On success, rule should:
      //
      // - update `state.line`
      // - update `state.tokens`
      // - return true
      for (const rule of rules) {
        if (rule(state, false, line, endLine)) {
          break;
        }
      }

      // set state.tight if we had an empty line before current tag
      // i.e. latest empty line should not count
      state.tight = !hasEmptyLines;

      // paragraph might "eat" one newline after it in nested lists
      if (state.isEmpty(state.line - 1)) {
        hasEmptyLines = true;
      }

      line = state.line;

      if (line < endLine && state.isEmpty(line)) {
        hasEmptyLines = true;
        state.line = ++line;
      }

      if (line === lineBefore) {
        if (ignoreError) {
          break;
        }

        const src = state.src.slice(state.bMarks[line], state.eMarks[line]);
        throw new NoParserError(
          `proper parsers are not available for line<${line}>: ${src}`
        );
      }
    }
  }
}

export type Delimiter = {
  // Boolean flags that determine if this delimiter could open or close an mark.
  open: boolean;
  close: boolean;

  // Total length of these series of delimiters.
  length: number;

  // Char code of the starting marker (number).
  marker: number;

  // An amount of characters before this one that's equivalent to
  // current one. In plain English: if this delimiter does not open
  // an emphasis, neither do previous `jump` characters.
  //
  // Used to skip sequences like "*****" in one step, for 1st asterisk
  // value will be 0, for 2nd it's 1 and so on.
  jump: number;

  // A position of the token this delimiter corresponds to.
  token: number;

  // If this delimiter is matched as a valid opener, `end` will be
  // equal to its position, otherwise it's `-1`.
  end: number;
};

export class InlineState<T = {}, P = {}> extends State<T, P> {
  tokensMeta = Array<{ delimiters: Delimiter[] } | undefined>(
    this.tokens.length
  );
  pos = 0;
  posMax = this.src.length;
  level = 0;
  pending = "";
  pendingLevel = 0;

  // Stores { start: end } pairs. Useful for backtrack optimization of pairs parse (emphasis, strikes).
  cache: Record<number, number> = {};
  // List of emphasis-like delimiters for current tag
  delimiters: Delimiter[] = [];
  // Stack of delimiter lists for upper level tags
  prevDelimiters: Delimiter[][] = [];
  // backtick length => last seen position
  backticks: Record<number, number> = {};
  backticksScanned = false;

  // Flush pending text
  pushPending() {
    const token = new Token("text", 0);
    token.content = this.pending;
    token.level = this.pendingLevel;
    this.tokens.push(token);
    this.pending = "";
    return token;
  }

  // Push new token to "stream". If pending text exists - flush it as text token
  push(name: string, nesting: Nesting) {
    if (this.pending) {
      this.pushPending();
    }

    const token = new Token(name, nesting);
    let tokenMeta = undefined;

    if (nesting < 0) {
      // closing tag
      this.level--;
      this.delimiters = this.prevDelimiters.pop() || [];
    }

    token.level = this.level;

    if (nesting > 0) {
      // opening tag
      this.level++;
      this.prevDelimiters.push(this.delimiters);
      this.delimiters = [];
      tokenMeta = { delimiters: this.delimiters };
    }

    this.pendingLevel = this.level;
    this.tokens.push(token);
    this.tokensMeta.push(tokenMeta);
    return token;
  }

  // Scan a sequence of emphasis-like markers, and determine whether it can start an emphasis sequence or end an emphasis sequence.
  scanDelims(
    // position to scan from (it should point at a valid marker);
    start: number,
    // determine if these markers can be found inside a word
    canSplitWord: boolean
  ) {
    const marker = this.src.charCodeAt(start);

    let pos = start;
    while (pos < this.posMax && this.src.charCodeAt(pos) === marker) {
      pos++;
    }

    // treat end of the line as a whitespace
    const nextChar = pos < this.posMax ? this.src.charCodeAt(pos) : 0x20;
    // treat beginning of the line as a whitespace
    const lastChar = start > 0 ? this.src.charCodeAt(start - 1) : 0x20;

    const isLastPunctChar =
      isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
    const isNextPunctChar =
      isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));

    const isLastWhiteSpace = isWhiteSpace(lastChar);
    const isNextWhiteSpace = isWhiteSpace(nextChar);

    let leftFlanking = true;
    if (isNextWhiteSpace) {
      leftFlanking = false;
    } else if (isNextPunctChar && !(isLastWhiteSpace || isLastPunctChar)) {
      leftFlanking = false;
    }

    let rightFlanking = true;
    if (isLastWhiteSpace) {
      rightFlanking = false;
    } else if (isLastPunctChar && !(isNextWhiteSpace || isNextPunctChar)) {
      rightFlanking = false;
    }

    let open: boolean;
    let close: boolean;

    if (!canSplitWord) {
      open = leftFlanking && (!rightFlanking || isLastPunctChar);
      close = rightFlanking && (!leftFlanking || isNextPunctChar);
    } else {
      open = leftFlanking;
      close = rightFlanking;
    }

    return {
      open,
      close,
      length: pos - start,
      marker,
    };
  }
}

type InlineHandle<T, P> = (
  this: Rule<InlineHandle<T, P>>,
  state: InlineState<T, P>,
  silent: boolean
) => boolean;

class InlineParser<T extends { options: Options }, P> extends Parser<
  T,
  P,
  InlineHandle<T, P>
> {
  parse(props: StateProps<T, P>) {
    const state = new InlineState(props);
    this.tokenize(state);
    return state;
  }

  tokenize(state: InlineState<T, P>) {
    const rules = this.ruler.getRules();
    const maxNesting = state.engine.options.maxNesting;

    while (state.pos < state.posMax) {
      // Try all possible rules.
      // On success, rule should:
      //
      // - update `state.pos`
      // - update `state.tokens`
      // - return true

      let ok = false;
      if (state.level < maxNesting) {
        for (const rule of rules) {
          ok = rule(state, false);
          if (ok) {
            break;
          }
        }
      }

      if (ok) {
        if (state.pos >= state.posMax) {
          break;
        }
        continue;
      }

      state.pending += state.src[state.pos++];
    }

    if (state.pending) {
      state.pushPending();
    }
  }

  skipToken(state: InlineState<T, P>) {
    const { pos, cache } = state;
    if (cache[pos] !== undefined) {
      state.pos = cache[pos];
      return;
    }

    let ok = false;
    const rules = this.ruler.getRules();
    const maxNesting = state.engine.options.maxNesting;
    if (state.level < maxNesting) {
      for (const rule of rules) {
        // Increment state.level and decrement it later to limit recursion. It's harmless to do here, because no tokens are created. But ideally,we'd need a separate private state variable for this purpose.
        state.level++;
        ok = rule(state, true);
        state.level--;

        if (ok) {
          break;
        }
      }
    } else {
      // Too much nesting, just skip until the end of the paragraph.
      // NOTE: this will cause links to behave incorrectly in the following case, when an amount of `[` is exactly equal to `maxNesting + 1`:
      //
      //       [[[[[[[[[[[[[[[[[[[[[foo]()
      //
      // TODO: remove this workaround when CM standard will allow nested links (we can replace it by preventing links from being parsed in validation mode)
      state.pos = state.posMax;
    }

    if (!ok) {
      state.pos++;
    }

    cache[pos] = state.pos;
  }
}

type PostInlineHandle<T, P> = (
  this: Rule<PostInlineHandle<T, P>>,
  state: InlineState<T, P>
) => void;

class PostInlineParser<T extends { options: Options }, P> extends Parser<
  T,
  P,
  PostInlineHandle<T, P>
> {
  parse(state: InlineState<T, P>) {
    this.ruler.getRules().forEach((rule) => rule(state));
  }
}

const defaultCoreRules = [
  {
    name: "normalize",
    handle: function normalize<T, P>(state: State<T, P>) {
      state.src = state.src
        .replace(NEWLINES_RE, "\n")
        .replace(NULL_RE, "\uFFFD");
    },
  },

  {
    name: "block",
    handle: function block<
      T extends { options: Options; block: BlockParser<T, P> },
      P
    >(state: State<T, P>) {
      if (state.inlineMode) {
        const token = new Token("", 0);
        token.content = state.src;
        token.map = [0, 1];
        token.children = [];
        state.tokens.push(token);
      } else {
        state.engine.block.parse(state);
      }
    },
  },

  {
    name: "inline",
    handle: function inline<
      T extends {
        options: Options;
        inline: InlineParser<T, P>;
        postInline: PostInlineParser<T, P>;
      },
      P
    >(state: State<T, P>) {
      const { inline, postInline } = state.engine;
      for (const { name, content: src, children: tokens } of state.tokens) {
        if (name === "" && src && tokens) {
          postInline.parse(
            inline.parse({
              ...state,
              src,
              tokens,
            })
          );
        }
      }
    },
  },
];

const defaultBlockRules = [] as BlockRule<any>[];

// !!!! Don't confuse with "Markdown ASCII Punctuation" chars
// http://spec.commonmark.org/0.15/#ascii-punctuation-character
const TEXT_TERMINATORS = new Set([
  0x0a /* \n */,
  0x21 /* ! */,
  0x23 /* # */,
  0x24 /* $ */,
  0x25 /* % */,
  0x26 /* & */,
  0x2a /* * */,
  0x2b /* + */,
  0x2d /* - */,
  0x3a /* : */,
  0x3c /* < */,
  0x3d /* = */,
  0x3e /* > */,
  0x40 /* @ */,
  0x5b /* [ */,
  0x5c /* \ */,
  0x5d /* ] */,
  0x5e /* ^ */,
  0x5f /* _ */,
  0x60 /* ` */,
  0x7b /* { */,
  0x7d /* } */,
  0x7e /* ~ */,
]);

const defaultInlineRules = [
  {
    // Rule to skip pure text
    // '{}$%@~+=:' reserved for extentions
    // !, ", #, $, %, &, ', (, ), *, +, ,, -, ., /, :, ;, <, =, >, ?, @, [, \, ], ^, _, `, {, |, }, or ~
    name: "text",
    handle: function text<T, P>(state: InlineState<T, P>, silent: boolean) {
      let pos = state.pos;

      while (
        pos < state.posMax &&
        !TEXT_TERMINATORS.has(state.src.charCodeAt(pos))
      ) {
        pos++;
      }

      if (pos === state.pos) {
        return false;
      }

      if (!silent) {
        state.pending += state.src.slice(state.pos, pos);
      }

      state.pos = pos;

      return true;
    },
  },
];

function balanceDelimiters(delimiters: Delimiter[]) {
  const openersBottom: Record<number, [number, number, number]> = {};

  for (let closerIdx = 0; closerIdx < delimiters.length; closerIdx++) {
    const closer = delimiters[closerIdx];

    // Length is only used for emphasis-specific "rule of 3",
    // if it's not defined (in strikethrough or 3rd party plugins),
    // we can default it to 0 to disable those checks.
    //
    closer.length = closer.length || 0;

    if (!closer.close) {
      continue;
    }

    // Previously calculated lower bounds (previous fails)
    // for each marker and each delimiter length modulo 3.
    if (!openersBottom.hasOwnProperty(closer.marker)) {
      openersBottom[closer.marker] = [-1, -1, -1];
    }

    const minOpenerIdx = openersBottom[closer.marker][closer.length % 3];

    let openerIdx = closerIdx - closer.jump - 1;
    let newMinOpenerIdx = openerIdx;

    while (openerIdx > minOpenerIdx) {
      const opener = delimiters[openerIdx];

      if (opener.marker !== closer.marker) {
        continue;
      }

      if (opener.open && opener.end < 0) {
        // from spec:
        //
        // If one of the delimiters can both open and close emphasis, then the
        // sum of the lengths of the delimiter runs containing the opening and
        // closing delimiters must not be a multiple of 3 unless both lengths
        // are multiples of 3.
        //
        const isOddMatch =
          (opener.close || closer.open) &&
          (opener.length + closer.length) % 3 === 0 &&
          (opener.length % 3 !== 0 || closer.length % 3 !== 0);

        if (!isOddMatch) {
          // If previous delimiter cannot be an opener, we can safely skip
          // the entire sequence in future checks. This is required to make
          // sure algorithm has linear complexity (see *_*_*_*_*_... case).
          //
          const lastJump =
            openerIdx > 0 && !delimiters[openerIdx - 1].open
              ? delimiters[openerIdx - 1].jump + 1
              : 0;

          closer.jump = closerIdx - openerIdx + lastJump;
          closer.open = false;
          opener.end = closerIdx;
          opener.jump = lastJump;
          opener.close = false;
          newMinOpenerIdx = -1;
          break;
        }
      }

      openerIdx -= opener.jump + 1;
    }

    if (newMinOpenerIdx !== -1) {
      // If match for this delimiter run failed, we want to set lower bound for
      // future lookups. This is required to make sure algorithm has linear
      // complexity.
      //
      // See details here:
      // https://github.com/commonmark/cmark/issues/178#issuecomment-270417442
      //
      openersBottom[closer.marker][(closer.length || 0) % 3] = newMinOpenerIdx;
    }
  }
}

const defaultPostInlineRules = [
  {
    // For each opening emphasis-like marker find a matching closing one
    name: "balance",
    handle: function balance<T, P>(state: InlineState<T, P>) {
      balanceDelimiters(state.delimiters);

      for (const meta of state.tokensMeta) {
        const delimiters = meta?.delimiters;
        delimiters && balanceDelimiters(delimiters);
      }
    },
  },
];

interface EngineOption<P> extends Options {
  coreRules?: CoreRule<P>[];
  blockRules?: BlockRule<P>[];
  inlineRules?: InlineRule<P>[];
  postInlineRules?: PostInlineRule<P>[];
}

export class Engine<P extends Record<string, any> = Env> {
  readonly core = new CoreParser<Engine<P>, P>();
  readonly block = new BlockParser<Engine<P>, P>();
  readonly inline = new InlineParser<Engine<P>, P>();
  readonly postInline = new PostInlineParser<Engine<P>, P>();

  readonly options: EngineOption<P> = {
    // Internal protection, recursion limit
    maxNesting: 100,
    // Throw error if no proper parser found by default
    ignoreError: false,
  };

  constructor(options?: Partial<EngineOption<P>>) {
    merge(this.options, options);
    this.reset();
  }

  reset() {
    this.core.ruler
      .clear()
      .add(...(this.options.coreRules || defaultCoreRules));

    this.block.ruler
      .clear()
      .add(...(this.options.blockRules || defaultBlockRules));

    this.inline.ruler
      .clear()
      .add(...(this.options.inlineRules || defaultInlineRules));

    this.postInline.ruler
      .clear()
      .add(...(this.options.postInlineRules || defaultPostInlineRules));

    return this;
  }

  parse(src: string, env = {} as P): Token[] {
    const props = { engine: this, src, env, tokens: [] };
    this.core.parse(props);
    return props.tokens;
  }
}

export type CoreRule<P = Env> = Rule<CoreHandle<Engine<P>, P>>;
export type CoreRuleHandle<P = Env> = CoreRule<P>["handle"];
export type BlockRule<P = Env> = Rule<BlockHandle<Engine<P>, P>>;
export type BlockRuleHandle<P = Env> = BlockRule<P>["handle"];
export type InlineRule<P = Env> = Rule<InlineHandle<Engine<P>, P>>;
export type InlineRuleHandle<P = Env> = InlineRule<P>["handle"];
export type PostInlineRule<P = Env> = Rule<PostInlineHandle<Engine<P>, P>>;
export type PostInlineRuleHandle<P = Env> = PostInlineRule<P>["handle"];
