import { Env, StateEnv, InlineRuleHandle } from "../../../editor";

export type BackticksStateEnv = StateEnv & {
  // backtick length => last seen position
  backticks?: Record<number, number>;
  backticksScanned?: boolean;
};

// Parse backticks
const handle: InlineRuleHandle<Env, BackticksStateEnv> = function backticks(
  state,
  silent
) {
  let pos = state.pos;
  const ch = state.src.charCodeAt(pos);

  if (ch !== 0x60 /* ` */) {
    return false;
  }

  let start = pos++;
  const max = state.posMax;

  // scan marker length
  while (pos < max && state.src.charCodeAt(pos) === 0x60 /* ` */) {
    pos++;
  }

  const marker = state.src.slice(start, pos);
  const openerLength = marker.length;
  const local = state.local;

  if (!local.backticks) {
    local.backticks = {};
  }

  if (local.backticksScanned && (local.backticks[openerLength] || 0) <= start) {
    if (!silent) {
      state.pending += marker;
    }
    state.pos += openerLength;
    return true;
  }

  let matchStart = pos;
  let matchEnd = pos;

  // Nothing found in the cache, scan until the end of the line (or until marker is found)
  while ((matchStart = state.src.indexOf("`", matchEnd)) !== -1) {
    matchEnd = matchStart + 1;

    // scan marker length
    while (matchEnd < max && state.src.charCodeAt(matchEnd) === 0x60 /* ` */) {
      matchEnd++;
    }

    const closerLength = matchEnd - matchStart;

    if (closerLength === openerLength) {
      // Found matching closer length.
      if (!silent) {
        const token = state.push(this.name, 0);
        token.markup = marker;
        token.content = state.src
          .slice(pos, matchStart)
          .replace(/\n/g, " ")
          .replace(/^ (.+) $/, "$1");
      }
      state.pos = matchEnd;
      return true;
    }

    // Some different length found, put it in cache as upper limit of where closer can be found
    local.backticks[closerLength] = matchStart;
  }

  // Scanned through the end, didn't find anything
  local.backticksScanned = true;

  if (!silent) {
    state.pending += marker;
  }

  state.pos += openerLength;
  return true;
};

export default handle;
