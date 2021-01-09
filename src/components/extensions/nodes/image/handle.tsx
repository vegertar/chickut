import { InlineRuleHandle, isSpace, Token } from "../../../editor";
import { ReferenceEnv } from "../reference/handle";
import {
  normalizeLink,
  normalizeReference,
  parseLinkDestination,
  parseLinkTitle,
  validateLink,
} from "../reference/utils";
import { parseLinkLabel } from "../../marks/link/handle";

// Process ![image](<src> "title")
const handle: InlineRuleHandle<ReferenceEnv> = function image(state, silent) {
  if (state.src.charCodeAt(state.pos) !== 0x21 /* ! */) {
    return false;
  }
  if (state.src.charCodeAt(state.pos + 1) !== 0x5b /* [ */) {
    return false;
  }

  const labelStart = state.pos + 2;
  const labelEnd = parseLinkLabel(state, state.pos + 1, false);

  // parser failed to find ']', so it's not a valid link
  if (labelEnd < 0) {
    return false;
  }

  const oldPos = state.pos;
  const max = state.posMax;

  let pos = labelEnd + 1;
  let href = "";
  let title: string | undefined;

  if (pos < max && state.src.charCodeAt(pos) === 0x28 /* ( */) {
    //
    // Inline link
    //

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
    let start = pos;
    let res = parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = normalizeLink(res.str);
      if (validateLink(href)) {
        pos = res.pos;
      } else {
        href = "";
      }
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
    } else {
      title = "";
    }

    if (pos >= max || state.src.charCodeAt(pos) !== 0x29 /* ) */) {
      state.pos = oldPos;
      return false;
    }
    pos++;
  } else {
    //
    // Link reference
    //
    if (!state.env.references) {
      return false;
    }

    let label: string | undefined;
    if (pos < max && state.src.charCodeAt(pos) === 0x5b /* [ */) {
      const start = pos + 1;
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
    const content = state.src.slice(labelStart, labelEnd);

    const tokens: Token[] = [];
    state.engine.inline.parse({
      tokens,
      src: content,
      engine: state.engine,
      env: state.env,
    });

    const token = state.push(this.name, 0, { src: href, alt: content });
    token.children = tokens;
    if (title) {
      token.attrs.title = title;
    }
  }

  state.pos = pos;
  state.posMax = max;
  return true;
};

export default handle;
