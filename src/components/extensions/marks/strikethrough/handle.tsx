import {
  Delimiter,
  InlineRuleHandle,
  InlineState,
  PostInlineRuleHandle,
} from "../../../editor";

// Insert each marker as a separate text token, and add it to delimiter list
export const handle: InlineRuleHandle = function strikethrough(state, silent) {
  if (silent) {
    return false;
  }

  const marker = state.src.charCodeAt(state.pos);
  if (marker !== 0x7e /* ~ */) {
    return false;
  }

  const scanned = state.scanDelims(state.pos, true);
  let len = scanned.length;
  const ch = String.fromCharCode(marker);

  if (len < 2) {
    return false;
  }

  if (len % 2) {
    state.push("text", 0).content = ch;
    len--;
  }

  for (let i = 0; i < len; i += 2) {
    state.push("text", 0).content = ch + ch;

    state.delimiters.push({
      ...scanned,
      end: -1,
      jump: i / 2, // for `~~` 1 marker = 2 characters
      token: state.tokens.length - 1,
      length: 0, // disable "rule of 3" length checks meant for emphasis
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
  const loneMarkers: number[] = [];

  for (const startDelim of delimiters) {
    if (startDelim.marker !== 0x7e /* ~ */) {
      continue;
    }

    if (startDelim.end === -1) {
      continue;
    }

    const endDelim = delimiters[startDelim.end];

    const openToken = state.tokens[startDelim.token];
    openToken.name = name;
    openToken.nesting = 1;
    openToken.markup = "~~";
    openToken.content = "";

    const closeToken = state.tokens[endDelim.token];
    closeToken.name = name;
    closeToken.nesting = -1;
    closeToken.markup = "~~";
    closeToken.content = "";

    if (
      state.tokens[endDelim.token - 1].name === "text" &&
      state.tokens[endDelim.token - 1].content === "~"
    ) {
      loneMarkers.push(endDelim.token - 1);
    }
  }

  // If a marker sequence has an odd number of characters, it's splitted
  // like this: `~~~~~` -> `~` + `~~` + `~~`, leaving one marker at the
  // start of the sequence.
  //
  // So, we have to move all those markers after subsequent s_close tags.
  //
  while (loneMarkers.length) {
    const i = loneMarkers.pop()!;
    let j = i + 1;

    while (
      j < state.tokens.length &&
      state.tokens[j].nesting === -1 &&
      state.tokens[j].name === name
    ) {
      j++;
    }

    j--;

    if (i !== j) {
      const token = state.tokens[j];
      state.tokens[j] = state.tokens[i];
      state.tokens[i] = token;
    }
  }
}

// Walk through delimiter list and replace text tokens with tags
export const postHandle: PostInlineRuleHandle = function strikethrough(state) {
  postProcess(this.name, state, state.delimiters);

  for (const meta of state.tokensMeta) {
    const delimiters = meta?.delimiters;
    delimiters && postProcess(this.name, state, delimiters);
  }
};
