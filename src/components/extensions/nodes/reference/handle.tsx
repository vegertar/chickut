import { BlockRuleHandle, Env, isSpace } from "../../../editor";

import {
  normalizeLink,
  normalizeReference,
  parseLinkDestination,
  parseLinkTitle,
  validateLink,
} from "./utils";

export type ReferenceEnv = Env & {
  references?: Record<string, { title: string; href: string }>;
};

const handle: BlockRuleHandle<ReferenceEnv> = function reference(
  state,
  silent,
  startLine
) {
  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) {
    return false;
  }

  let pos = state.bMarks[startLine] + state.tShift[startLine];
  if (state.src.charCodeAt(pos) !== 0x5b /* [ */) {
    return false;
  }

  let max = state.eMarks[startLine];

  // Simple check to quickly interrupt scan on [link](url) at the start of line.
  // Can be useful on practice: https://github.com/markdown-it/markdown-it/issues/54
  while (++pos < max) {
    if (
      state.src.charCodeAt(pos) === 0x5d /* ] */ &&
      state.src.charCodeAt(pos - 1) !== 0x5c /* \ */
    ) {
      if (pos + 1 === max) {
        return false;
      }
      if (state.src.charCodeAt(pos + 1) !== 0x3a /* : */) {
        return false;
      }
      break;
    }
  }

  const endLine = state.lineMax;
  let nextLine = startLine + 1;

  // jump line-by-line until empty one or EOF
  const terminatorRules = state.engine.block.ruler.getRules(this.name);

  const oldParent = state.parent;
  state.parent = this.name;

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

  const str = state
    .getLines(startLine, nextLine, state.blkIndent, false)
    .trim();
  max = str.length;

  let labelEnd = -1;
  let lines = 0;
  for (pos = 1; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 0x5b /* [ */) {
      return false;
    } else if (ch === 0x5d /* ] */) {
      labelEnd = pos;
      break;
    } else if (ch === 0x0a /* \n */) {
      lines++;
    } else if (ch === 0x5c /* \ */) {
      pos++;
      if (pos < max && str.charCodeAt(pos) === 0x0a) {
        lines++;
      }
    }
  }

  if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 0x3a /* : */) {
    return false;
  }

  // [label]:   destination   'title'
  //         ^^^ skip optional whitespace here
  for (pos = labelEnd + 2; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 0x0a) {
      lines++;
    } else if (isSpace(ch)) {
      /*eslint no-empty:0*/
    } else {
      break;
    }
  }

  // [label]:   destination   'title'
  //            ^^^^^^^^^^^ parse this
  let res = parseLinkDestination(str, pos, max);
  if (!res.ok) {
    return false;
  }

  const href = normalizeLink(res.str);
  if (!validateLink(href)) {
    return false;
  }

  pos = res.pos;
  lines += res.lines;

  // save cursor state, we could require to rollback later
  const destEndPos = pos;
  const destEndLineNo = lines;

  // [label]:   destination   'title'
  //                       ^^^ skipping those spaces
  const start = pos;
  for (; pos < max; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 0x0a) {
      lines++;
    } else if (isSpace(ch)) {
      /*eslint no-empty:0*/
    } else {
      break;
    }
  }

  // [label]:   destination   'title'
  //                          ^^^^^^^ parse this
  res = parseLinkTitle(str, pos, max);
  let title: string;
  if (pos < max && start !== pos && res.ok) {
    title = res.str;
    pos = res.pos;
    lines += res.lines;
  } else {
    title = "";
    pos = destEndPos;
    lines = destEndLineNo;
  }

  // skip trailing spaces until the rest of the line
  while (pos < max) {
    const ch = str.charCodeAt(pos);
    if (!isSpace(ch)) {
      break;
    }
    pos++;
  }

  if (pos < max && str.charCodeAt(pos) !== 0x0a) {
    if (title) {
      // garbage at the end of the line after title,
      // but it could still be a valid reference if we roll back
      title = "";
      pos = destEndPos;
      lines = destEndLineNo;
      while (pos < max) {
        const ch = str.charCodeAt(pos);
        if (!isSpace(ch)) {
          break;
        }
        pos++;
      }
    }
  }

  if (pos < max && str.charCodeAt(pos) !== 0x0a) {
    // garbage at the end of the line
    return false;
  }

  const label = normalizeReference(str.slice(1, labelEnd));
  if (!label) {
    // CommonMark 0.20 disallows empty labels
    return false;
  }

  // Reference can not terminate anything. This check is for safety only.
  /*istanbul ignore if*/
  if (silent) {
    return true;
  }

  if (!state.env.references) {
    state.env.references = {};
  }
  if (!state.env.references[label]) {
    state.env.references[label] = { title: title, href: href };
  }

  state.parent = oldParent;
  state.line = startLine + lines + 1;

  // make tokens to create element within Prosemirror
  state.push(this.name, 1, { label, title, href });
  state.push(this.name, -1);
  return true;
};

export default handle;
