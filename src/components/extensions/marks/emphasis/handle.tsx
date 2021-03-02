import {
  Delimiter,
  InlineRuleHandle,
  InlineState,
  PostInlineRuleHandle,
  Token,
} from "../../../editor";

export const handle: InlineRuleHandle = function emphasis(state, silent) {
  if (silent) {
    return false;
  }

  const marker = state.src.charCodeAt(state.pos);
  if (marker !== 0x5f /* _ */ && marker !== 0x2a /* * */) {
    return false;
  }

  const markup = String.fromCharCode(marker);
  const scanned = state.scanDelims(state.pos, marker === 0x2a);
  for (let i = 0; i < scanned.length; i++) {
    state.push("text", 0).content = markup;

    state.delimiters.push({
      ...scanned,
      end: -1,
      jump: i,
      token: state.tokens.length - 1,
    });
  }

  state.pos += scanned.length;
  return true;
};

function postProcess(
  name: string,
  state: InlineState,
  delimiters: Delimiter[]
) {
  const pairs: number[] = [];

  // iterating from inner to outer
  for (let i = delimiters.length - 1; i >= 0; i--) {
    const startDelim = delimiters[i];

    if (
      startDelim.marker !== 0x5f /* _ */ &&
      startDelim.marker !== 0x2a /* * */
    ) {
      continue;
    }

    // Process only opening markers
    if (startDelim.end === -1) {
      continue;
    }

    const endDelim = delimiters[startDelim.end];

    // If the previous delimiter has the same marker and is adjacent to this one,
    // merge those into one strong delimiter.
    //
    // `<em><em>whatever</em></em>` -> `<strong>whatever</strong>`
    const isStrong =
      i > 0 &&
      delimiters[i - 1].end === startDelim.end + 1 &&
      delimiters[i - 1].token === startDelim.token - 1 &&
      delimiters[startDelim.end + 1].token === endDelim.token + 1 &&
      delimiters[i - 1].marker === startDelim.marker;

    const ch = String.fromCharCode(startDelim.marker);
    const markup = isStrong ? ch + ch : ch;

    const openToken = state.tokens[startDelim.token];
    openToken.nesting = 1;
    openToken.name = name;
    openToken.content = markup; // save markup temporarily
    openToken.attrs = { isStrong };

    const closeToken = state.tokens[endDelim.token];
    closeToken.nesting = -1;
    closeToken.name = openToken.name;
    closeToken.content = "";
    closeToken.attrs = openToken.attrs;

    pairs.push(startDelim.token, endDelim.token);

    if (isStrong) {
      state.tokens[delimiters[i - 1].token].content = "";
      state.tokens[delimiters[startDelim.end + 1].token].content = "";
      i--;
    }
  }

  for (let i = 0; i < pairs.length; i += 2) {
    const openIndex = pairs[i];
    const closeIndex = pairs[i + 1] + i;

    const openToken = state.tokens[openIndex];

    const openMarkup = new Token("markup", 0);
    openMarkup.content = openToken.content;

    const closeMarkup = new Token("markup", 0);
    closeMarkup.content = openToken.content;

    openToken.content = "";

    state.tokens.splice(openIndex + 1, 0, openMarkup);
    state.tokens.splice(closeIndex + 1, 0, closeMarkup);

    // fix after delimiters
    for (const startDelim of delimiters) {
      if (
        startDelim.marker !== 0x5f /* _ */ &&
        startDelim.marker !== 0x2a /* * */ &&
        startDelim.end !== -1
      ) {
        if (startDelim.token > closeIndex) {
          startDelim.token += 2;
        } else if (startDelim.token > openIndex) {
          startDelim.token += 1;
        }

        const endDelim = delimiters[startDelim.end];
        if (endDelim.token > closeIndex) {
          endDelim.token += 2;
        } else if (endDelim.token > openIndex) {
          endDelim.token += 1;
        }
      }
    }
  }
}

// Walk through delimiter list and replace text tokens with tags
export const postHandle: PostInlineRuleHandle = function emphasis(state) {
  postProcess(this.name, state, state.delimiters);

  for (const meta of state.tokensMeta) {
    const delimiters = meta?.delimiters;
    delimiters && postProcess(this.name, state, delimiters);
  }
};
