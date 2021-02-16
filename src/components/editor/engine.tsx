// Text engine pruning from markdown-it

import merge from "lodash.merge";
import sortedIndex from "lodash.sortedindex";

import {
  expandTab,
  isMdAsciiPunct,
  isPunctChar,
  isSpace,
  isWhiteSpace,
} from "./utils";

export class NoParserError extends Error {}

export interface Options {
  maxNesting: number;
  ignoreError: boolean;
}

export interface Env {
  [key: string]: any;
}

export interface StateEnv {
  [key: string]: any;
}

// 1: opening, 0: self closing, -1: clsoing
type Nesting = 1 | 0 | -1;

type Attrs = { [name: string]: any };
type AttrsToken = Token & { attrs: Attrs };

type Line = {
  markup: string;
  indent: number;
  index: number;
  content: string;
};

export class Lines {
  private readonly lines: Line[] = [];
  private readonly lineEnds: number[] = [];

  append(line: Line) {
    this.lines.push(line);
    this.lineEnds.push(
      (this.lineEnds[this.lineEnds.length - 1] || 0) +
        line.indent +
        (line.content.length - line.index)
    );
  }

  at(pos: number) {
    if (pos === 0) {
      return 0;
    }
    const i = sortedIndex(this.lineEnds, pos);
    return this.lineEnds[i] === pos ? i + 1 : -1;
  }

  get(line: number) {
    return this.lines[line];
  }

  toString() {
    // partially expanding tabs in code blocks, e.g '\t\tfoobar'
    // with indent=2 becomes '  \tfoobar'
    return this.lines
      .map((line) => " ".repeat(line.indent) + line.content.slice(line.index))
      .join("");
  }
}

export class Token {
  // Nesting level, the same as `state.level`
  level?: number;
  // An array of child nodes
  children?: Token[];
  // Text content of this tag.
  content?: string;
  // Indicating if text content contains code
  code?: boolean;
  // For inline token content acrossing multiple lines this field carries content
  // TODO: combine lines with content
  lines?: Lines;

  constructor(
    // Preserve names:
    //   "": the root of inline token, which contains actual inline children with name, e.g. "text"
    //   "text": the leaf token contains the text content
    //   "blank": the leaf token contains the blank line
    //   "markup": the leaf token contains the markup
    public name: string,
    public nesting: Nesting,
    public attrs?: Attrs
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

class State<T, P, L extends StateEnv> {
  engine: T;
  src: string;
  tokens: Token[];

  // arbitary data bound to the user passing env at init
  readonly env: P;
  // arbitary data bound to specific parsing phase, e.g. core, block, inline, and so on
  readonly local: L;

  constructor({ src, engine, tokens, env }: StateProps<T, P>) {
    this.src = src;
    this.engine = engine;
    this.tokens = tokens;
    this.env = env;
    this.local = {} as L;
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
    rules.forEach((rule) => this.append(rule));
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

  // Find rule index by name
  find(name: string) {
    return this.rules.findIndex((item) => item.name === name);
  }

  // Insert a new rule at the specific index.
  insert(rule: Rule<H>, index?: number) {
    if (index === undefined || index >= this.rules.length) {
      return this.append(rule);
    }

    this.rules.splice(index, 0, rule);
    this.cache = undefined;
    return this;
  }

  // Add a new rule to the end of chain.
  append(rule: Rule<H>) {
    this.rules.push(rule);
    this.cache = undefined;
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

  // Remove existed rule by given name.
  remove(name: string) {
    const idx = this.find(name);
    if (idx !== -1) {
      this.rules.splice(idx, 1);
      this.cache = undefined;
    }
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

type CoreHandle<T, P, L = StateEnv> = (
  this: Rule<CoreHandle<T, P, L>>,
  state: State<T, P, L>
) => void;

export class CoreState<T = {}, P = {}, L = {}> extends State<T, P, L> {}

class CoreParser<T, P> extends Parser<T, P, CoreHandle<T, P>> {
  parse(props: StateProps<T, P>) {
    const state = new CoreState(props);
    this.ruler.getRules().forEach((rule) => rule(state));
  }
}

export class BlockState<T = {}, P = {}, L = {}> extends State<T, P, L> {
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
  // used in lists to determine if they interrupt a paragraph
  parent = "";
  // nesting level
  level = 0;

  constructor(props: StateProps<T, P>) {
    super(props);

    let blankEnding = false;
    let indentFound = false;
    let start = 0;
    let indent = 0;
    let offset = 0;
    let pos = 0;

    const len = this.src.length;
    for (; pos < len; pos++) {
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

          if (pos === len - 1) {
            blankEnding = true;
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
        this.add(start, pos, indent, offset, 0);

        // set a new line
        indentFound = false;
        indent = 0;
        offset = 0;
        start = pos + 1;

        if (pos === len - 1 && ch === 0x0a) {
          blankEnding = true;
        }
      }
    }

    if (blankEnding) {
      // add the last blank line(s which might be acrossing multiple rows)
      this.add(start, len, indent, offset, 0);
    }

    // Push fake entry to simplify cache bounds checks
    this.add(len, len, 0, 0, 0);

    this.lineMax = this.bMarks.length - 1; // don't count last fake line
  }

  add(b: number, e: number, t: number, s: number, bs: number) {
    this.bMarks.push(b);
    this.eMarks.push(e);
    this.tShift.push(t);
    this.sCount.push(s);
    this.bsCount.push(bs);
  }

  // Push new token to "stream".
  push(name: string, nesting: Nesting): Token;
  push(name: string, nesting: Nesting, attrs: Attrs): AttrsToken;
  push(name: string, nesting: Nesting, attrs?: Attrs) {
    const token = new Token(name, nesting, attrs);

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

  pushMarkup(line: number) {
    const markup = this.src.slice(this.eMarks[line - 1] + 1, this.bMarks[line]);
    if (markup) {
      const token = this.push("markup", 0, { block: true });
      token.content = markup;
      return token;
    }
  }

  pushBlank(line: number) {
    const blank = this.src.slice(this.bMarks[line], this.eMarks[line]);
    this.push("blank", 0).content = blank;
    return blank;
  }

  eatBlankLines(from: number, to = this.lineMax) {
    for (; from < to; from++) {
      if (!this.isEmpty(from)) {
        break;
      }
      if (!this.pushMarkup(from)) {
        // if has markup then this line is not an actual blank
        this.pushBlank(from);
      }
    }
    return from;
  }

  isEmpty(line: number) {
    return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
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
    const lines = new Lines();

    for (let line = begin; line < end; line++) {
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

      lines.append({
        markup:
          line > begin
            ? this.src.slice(this.eMarks[line - 1] + 1, this.bMarks[line])
            : "",
        indent: lineIndent > indent ? lineIndent - indent : 0,
        content: this.src.slice(lineStart, last),
        index: first - lineStart,
      });
    }

    return lines;
  }

  mergeMarkup(target: string, from: number, to = this.tokens.length) {
    for (let j = to - 2; j > from; --j) {
      const { name, nesting } = this.tokens[j];
      if (name === target && nesting === 1) {
        const prev = this.tokens[j - 1];
        const next = this.tokens[j + 1];
        if (
          prev.name === "markup" &&
          prev.name === next.name &&
          prev.attrs?.block &&
          next.attrs?.block &&
          next.content!.startsWith(prev.content!)
        ) {
          next.content = next.content!.slice(prev.content!.length);
          --j;
        }
      }
    }
  }
}

type BlockHandle<T, P, L = StateEnv> = (
  this: Rule<BlockHandle<T, P, L>>,
  state: BlockState<T, P, L>,

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

    const state = new BlockState(props);
    this.tokenize(state, state.line, state.lineMax);
  }

  tokenize(state: BlockState<T, P>, startLine: number, endLine: number) {
    const rules = this.ruler.getRules();
    const { maxNesting, ignoreError } = state.engine.options;
    let line = startLine;
    let hasEmptyLines = false;

    const i = state.tokens.length;

    while (line < endLine) {
      state.line = line = state.eatBlankLines(line);
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

      state.pushMarkup(line);
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

      if (line < endLine && state.eatBlankLines(line, line + 1) > line) {
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

    if (state.parent) {
      state.mergeMarkup(state.parent, i);
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

export class InlineState<T = {}, P = {}, L = {}> extends State<T, P, L> {
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
  // Additional lines info retrieved from block getLines
  lines?: Lines;

  constructor({ lines, ...props }: StateProps<T, P> & { lines?: Lines }) {
    super(props);
    this.lines = lines;
  }

  // Flush pending text
  pushPending() {
    const token = new Token("text", 0);
    token.content = this.pending;
    token.level = this.pendingLevel;
    this.tokens.push(token);
    this.pending = "";
    return token;
  }

  pushMarkup(line: number) {
    if (line < 0 || !this.lines) {
      return;
    }

    const { markup, index, content } = this.lines.get(line);
    const s = `${markup}${content.slice(markup.length, index)}`;
    if (s) {
      const token = this.push("markup", 0, { block: true });
      token.content = s;
      return token;
    }
  }

  // Push new token to "stream". If pending text exists - flush it as text token
  push(name: string, nesting: Nesting): Token;
  push(name: string, nesting: Nesting, attrs: Attrs): AttrsToken;
  push(name: string, nesting: Nesting, attrs?: Attrs) {
    if (this.pending) {
      this.pushPending();
    }

    const token = new Token(name, nesting, attrs);
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

type InlineHandle<T, P, L = StateEnv> = (
  this: Rule<InlineHandle<T, P, L>>,
  state: InlineState<T, P, L>,
  silent: boolean
) => boolean;

class InlineParser<T extends { options: Options }, P> extends Parser<
  T,
  P,
  InlineHandle<T, P>
> {
  parse(props: StateProps<T, P> & { lines?: Lines }) {
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

      if (state.lines) {
        state.pushMarkup(state.lines.at(state.pos));
      }

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

type PostInlineHandle<T, P, L = StateEnv> = (
  this: Rule<PostInlineHandle<T, P, L>>,
  state: InlineState<T, P, L>
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
    this.core.ruler.clear();
    this.block.ruler.clear();
    this.inline.ruler.clear();
    this.postInline.ruler.clear();
    return this;
  }

  parse(src: string, env: P): Token[] {
    const props = { engine: this, src, env, tokens: [] };
    this.core.parse(props);
    return props.tokens;
  }
}

export type CoreRule<P = Env, L = StateEnv> = Rule<CoreHandle<Engine<P>, P, L>>;
export type CoreRuleHandle<P = Env, L = StateEnv> = CoreRule<P, L>["handle"];
export type BlockRule<P = Env, L = StateEnv> = Rule<
  BlockHandle<Engine<P>, P, L>
>;
export type BlockRuleHandle<P = Env, L = StateEnv> = BlockRule<P, L>["handle"];
export type InlineRule<P = Env, L = StateEnv> = Rule<
  InlineHandle<Engine<P>, P, L>
>;
export type InlineRuleHandle<P = Env, L = StateEnv> = InlineRule<
  P,
  L
>["handle"];
export type PostInlineRule<P = Env, L = StateEnv> = Rule<
  PostInlineHandle<Engine<P>, P, L>
>;
export type PostInlineRuleHandle<P = Env, L = StateEnv> = PostInlineRule<
  P,
  L
>["handle"];
