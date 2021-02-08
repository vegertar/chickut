import {
  BlockRuleHandle,
  InlineRuleHandle,
  PostInlineRuleHandle,
  CoreRuleHandle,
  Delimiter,
} from "../../../editor";

const NEWLINES_RE = /\r\n?|\n/g;
const NULL_RE = /\0/g;

export const normalize: CoreRuleHandle = function (state) {
  state.src = state.src.replace(NEWLINES_RE, "\n").replace(NULL_RE, "\uFFFD");
};

export const block: CoreRuleHandle = function (state) {
  state.engine.block.parse(state);
};

export const inline: CoreRuleHandle = function (state) {
  const { inline, postInline } = state.engine;
  for (const {
    name,
    lines,
    content: src = lines?.toString(),
    children: tokens,
  } of state.tokens) {
    if (name === "" && src && tokens) {
      postInline.parse(
        inline.parse({
          ...state,
          src,
          tokens,
          lines,
        })
      );
    }
  }
};

export function combineCore(...handles: CoreRuleHandle[]): CoreRuleHandle {
  return function (state) {
    for (const handle of handles) {
      handle.call(this, state);
    }
  };
}

export const setup = combineCore(normalize, block, inline);

export const paragraph: BlockRuleHandle = function paragraph(
  state,
  silent,
  startLine
) {
  const name = this.name;
  const terminatorRules = state.engine.block.ruler.getRules(name);
  const endLine = state.lineMax;

  const oldParent = state.parent;
  state.parent = name;

  let nextLine = startLine + 1;
  // jump line-by-line until empty one or EOF
  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    // this would be a code block normally, but after paragraph
    // it's considered a lazy continuation regardless of what's there
    if (state.sCount[nextLine] - state.blkIndent > 3) {
      continue;
    }

    // quirk for blockquotes, this line should already be checked by that rule
    if (state.sCount[nextLine] < 0) {
      continue;
    }

    // Some tags can terminate paragraph without empty line.
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
  }

  const lines = state.getLines(startLine, nextLine, state.blkIndent);
  state.line = nextLine;
  state.push(name, 1);

  const inlineToken = state.push("", 0);
  inlineToken.lines = lines;
  inlineToken.children = [];

  state.push(name, -1);
  state.parent = oldParent;

  return true;
};

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

// Skip text characters for text token, place those to pending buffer
// and increment current pos
export const text: InlineRuleHandle = function (state, silent) {
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
};

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

    // avoid crash if `closer.jump` is pointing outside of the array, see #742
    if (openerIdx < -1) {
      openerIdx = -1;
    }

    let newMinOpenerIdx = openerIdx;

    for (
      let opener: Delimiter;
      openerIdx > minOpenerIdx;
      openerIdx -= opener.jump + 1
    ) {
      opener = delimiters[openerIdx];

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

// For each opening emphasis-like marker find a matching closing one
export const balancePairs: PostInlineRuleHandle = function (state) {
  balanceDelimiters(state.delimiters);

  for (const meta of state.tokensMeta) {
    const delimiters = meta?.delimiters;
    delimiters && balanceDelimiters(delimiters);
  }
};

export const textCollapse: PostInlineRuleHandle = function (state) {
  // Clean up tokens after emphasis and strikethrough postprocessing:
  // merge adjacent text nodes into one and re-calculate all token levels
  //
  // This is necessary because initially emphasis delimiter markers (*, _, ~)
  // are treated as their own separate text tokens. Then emphasis rule either
  // leaves them as text (needed to merge with adjacent text) or turns them
  // into opening/closing tags (which messes up levels inside).
  //
  const max = state.tokens.length;
  const tokens = state.tokens;

  let curr: number;
  let last: number;
  let level = 0;
  for (curr = last = 0; curr < max; curr++) {
    // re-calculate levels after emphasis/strikethrough turns some text nodes
    // into opening/closing tags
    if (tokens[curr].nesting < 0) {
      level--; // closing tag
    }
    tokens[curr].level = level;
    if (tokens[curr].nesting > 0) {
      level++; // opening tag
    }

    if (
      tokens[curr].name === this.name &&
      curr + 1 < max &&
      tokens[curr + 1].name === this.name
    ) {
      // collapse two adjacent text nodes
      tokens[curr + 1].content =
        (tokens[curr].content || "") + (tokens[curr + 1].content || "");
    } else {
      // copy backward
      if (curr !== last) {
        tokens[last] = tokens[curr];
      }

      last++;
    }
  }

  if (curr !== last) {
    tokens.length = last;
  }
};
