import {
  Delimiter,
  InlineRuleHandle,
  InlineState,
  PostInlineRuleHandle,
} from "../../../editor";

export const handle: InlineRuleHandle = function emphasis(state, silent) {
  if (silent) {
    return false;
  }

  const marker = state.src.charCodeAt(state.pos);
  if (marker !== 0x5f /* _ */ && marker !== 0x2a /* * */) {
    return false;
  }

  const scanned = state.scanDelims(state.pos, marker === 0x2a);
  for (let i = 0; i < scanned.length; i++) {
    const token = state.push("text", 0);
    token.content = String.fromCharCode(marker);
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
    openToken.name = name;
    openToken.nesting = 1;
    openToken.markup = markup;
    openToken.content = "";
    openToken.attrs = { isStrong, markup };

    const closeToken = state.tokens[endDelim.token];
    closeToken.name = name;
    closeToken.nesting = -1;
    closeToken.markup = undefined;
    closeToken.content = undefined;
    closeToken.attrs = undefined;

    if (isStrong) {
      state.tokens[delimiters[i - 1].token].content = undefined;
      state.tokens[delimiters[startDelim.end + 1].token].content = undefined;
      i--;
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
