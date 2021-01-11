import { InlineRuleHandle } from "../../../editor";

// same as UNESCAPE_MD_RE plus a space
const UNESCAPE_RE = /\\([ \\!"#$%&'()*+,./:;<=>?@[\]^_`{|}~-])/g;

const MARKERS = [0x7e /* ~ */, 0x5e /* ^ */];

const handle: InlineRuleHandle = function subsup(state, silent) {
  const start = state.pos;
  const marker = state.src.charCodeAt(start);
  if (MARKERS.indexOf(marker) < 0) {
    return false;
  }

  // don't run any pairs in validation mode
  if (silent) {
    return false;
  }

  const max = state.posMax;
  if (start + 2 >= max) {
    return false;
  }

  let found = false;
  state.pos = start + 1;

  while (state.pos < max) {
    if (state.src.charCodeAt(state.pos) === marker) {
      found = true;
      break;
    }

    state.engine.inline.skipToken(state);
  }

  if (!found || start + 1 === state.pos) {
    state.pos = start;
    return false;
  }

  const content = state.src.slice(start + 1, state.pos);

  // don't allow unescaped spaces/newlines inside
  if (content.match(/(^|[^\\])(\\\\)*\s/)) {
    state.pos = start;
    return false;
  }

  // found!
  state.posMax = state.pos;
  state.pos = start + 1;

  // Earlier we checked !silent, but this implementation does not need it
  const markup = state.src[start];
  state.push(this.name, 1, { markup }).markup = markup;
  state.push("text", 0).content = content.replace(UNESCAPE_RE, "$1");
  state.push(this.name, -1);

  state.pos = state.posMax + 1;
  state.posMax = max;
  return true;
};

export default handle;
