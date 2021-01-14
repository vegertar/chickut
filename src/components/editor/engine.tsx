// Text engine pruning from markdown-it

import { Transaction } from "prosemirror-state";
import merge from "lodash.merge";

import { ExtensionSchema } from "./types";
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
  tr: Transaction<ExtensionSchema>;
  typing?: boolean;
  [key: string]: any;
}

export interface StateEnv {
  [key: string]: any;
}

// 1: opening, 0: self closing, -1: clsoing
type Nesting = 1 | 0 | -1;

export class Token {
  // Source map info. Format: `[ line_begin, line_end ]`
  map?: [number, number];
  // nesting level, the same as `state.level`
  level?: number;
  // An array of child nodes
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
    //   "text": the final leaf token without marks and children.
    public name: string,
    // In case of
    //   root inline token,
    //   leaf text,
    //   and whatever self-closed tags (e.g. <br>, <hr>),
    //   leaf blocks never have marks (e.g. code, fence, HTML),
    // the nesting is 0
    public nesting: Nesting,
    // Token attributes, e.g. html attributes, heading level, fence info, etc.
    public attrs?: Record<string, any>
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
  inlineMode = false;

  engine: T;
  src: string;
  tokens: Token[];
  env: P;
  local: L;

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
  push(name: string, nesting: Nesting): Token;
  push(
    name: string,
    nesting: Nesting,
    attrs: Record<string, any>
  ): Token & { attrs: Record<string, any> };
  push(name: string, nesting: Nesting, attrs?: Record<string, any>) {
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
  push(name: string, nesting: Nesting): Token;
  push(
    name: string,
    nesting: Nesting,
    attrs: Record<string, any>
  ): Token & { attrs: Record<string, any> };
  push(name: string, nesting: Nesting, attrs?: Record<string, any>) {
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

  parse(src: string, env = {} as P): Token[] {
    console.log(
      "~~~~~~~~~~~",
      this.core,
      this.block,
      this.inline,
      this.postInline
    );
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
