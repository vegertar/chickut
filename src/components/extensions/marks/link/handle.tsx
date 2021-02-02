import {
  Engine,
  InlineRuleHandle,
  InlineState,
  isSpace,
} from "../../../editor";
import { ReferenceEnv } from "../../nodes/reference/handle";
import {
  normalizeLink,
  normalizeReference,
  parseLinkDestination,
  parseLinkTitle,
  validateLink,
} from "../../nodes/reference/utils";

type State = InlineState<Engine, ReferenceEnv>;

export function parseLinkLabel(
  state: State,
  start: number,
  disableNested = false
) {
  const oldPos = state.pos;
  const max = state.posMax;

  let level = 1;
  let found = false;

  state.pos = start + 1;
  while (state.pos < max) {
    const marker = state.src.charCodeAt(state.pos);
    if (marker === 0x5d /* ] */) {
      level--;
      if (level === 0) {
        found = true;
        break;
      }
    }

    const prevPos = state.pos;
    state.engine.inline.skipToken(state);
    if (marker === 0x5b /* [ */) {
      if (prevPos === state.pos - 1) {
        // increase level if we find text `[`, which is not a part of any token
        level++;
      } else if (disableNested) {
        state.pos = oldPos;
        return -1;
      }
    }
  }

  const labelEnd = found ? state.pos : -1;

  // restore old state
  state.pos = oldPos;

  return labelEnd;
}

// Process [link](<to> "stuff")
const handle: InlineRuleHandle = function link(state: State, silent) {
  if (state.src.charCodeAt(state.pos) !== 0x5b /* [ */) {
    return false;
  }

  const labelStart = state.pos + 1;
  const labelEnd = parseLinkLabel(state, state.pos, true);

  // parser failed to find ']', so it's not a valid link
  if (labelEnd < 0) {
    return false;
  }

  const max = state.posMax;
  const oldPos = state.pos;

  let pos = labelEnd + 1;
  let parseReference = true;
  let start = state.pos;
  let href = "";
  let title = "";

  if (pos < max && state.src.charCodeAt(pos) === 0x28 /* ( */) {
    //
    // Inline link
    //

    // might have found a valid shortcut link, disable reference parsing
    parseReference = false;

    // [link](  <href>  "title"  )
    //        ^^ skipping these spaces
    pos++;
    for (; pos < max; pos++) {
      const code = state.src.charCodeAt(pos);
      if (!isSpace(code) && code !== 0x0a) {
        break;
      }
    }
    if (pos >= max) {
      return false;
    }

    // [link](  <href>  "title"  )
    //          ^^^^^^ parsing link destination
    start = pos;
    let res = parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = normalizeLink(res.str);
      if (validateLink(href)) {
        pos = res.pos;
      } else {
        href = "";
      }

      // [link](  <href>  "title"  )
      //                ^^ skipping these spaces
      start = pos;
      for (; pos < max; pos++) {
        const code = state.src.charCodeAt(pos);
        if (!isSpace(code) && code !== 0x0a) {
          break;
        }
      }

      // [link](  <href>  "title"  )
      //                  ^^^^^^^ parsing link title
      res = parseLinkTitle(state.src, pos, state.posMax);
      if (pos < max && start !== pos && res.ok) {
        title = res.str;
        pos = res.pos;

        // [link](  <href>  "title"  )
        //                         ^^ skipping these spaces
        for (; pos < max; pos++) {
          const code = state.src.charCodeAt(pos);
          if (!isSpace(code) && code !== 0x0a) {
            break;
          }
        }
      }
    }

    if (pos >= max || state.src.charCodeAt(pos) !== 0x29 /* ) */) {
      // parsing a valid shortcut link failed, fallback to reference
      parseReference = true;
    }
    pos++;
  }

  if (parseReference) {
    //
    // Link reference
    //
    if (!state.env.references) {
      return false;
    }

    let label: string | undefined;
    if (pos < max && state.src.charCodeAt(pos) === 0x5b /* [ */) {
      start = pos + 1;
      pos = parseLinkLabel(state, pos);
      if (pos >= 0) {
        label = state.src.slice(start, pos++);
      } else {
        pos = labelEnd + 1;
      }
    } else {
      pos = labelEnd + 1;
    }

    // covers label === '' and label === undefined
    // (collapsed reference link and shortcut reference link respectively)
    if (!label) {
      label = state.src.slice(labelStart, labelEnd);
    }

    const ref = state.env.references[normalizeReference(label)];
    if (!ref) {
      state.pos = oldPos;
      return false;
    }
    href = ref.href;
    title = ref.title;
  }

  //
  // We found the end of the link, and know for a fact it's a valid link;
  // so all that's left to do is to call tokenizer.
  //
  if (!silent) {
    state.pos = labelStart;
    state.posMax = labelEnd;

    const openToken = state.push(this.name, 1, { href });
    openToken.markup = state.src.slice(oldPos, labelStart);
    if (title) {
      openToken.attrs.title = title;
    }

    state.engine.inline.tokenize(state);

    const closeToken = state.push(this.name, -1);
    closeToken.markup = state.src.slice(labelStart, pos);
  }

  state.pos = pos;
  state.posMax = max;
  return true;
};

export default handle;
