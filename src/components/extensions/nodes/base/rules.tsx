import {
  BlockRuleHandle,
  InlineRuleHandle,
  PostInlineRuleHandle,
} from "../../../editor";

export const paragraphHandle: BlockRuleHandle = function paragraph(
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

  // we don't trim content for friendly typing, however
  let content = state.getLines(startLine, nextLine, state.blkIndent, false);
  if (!state.env.typing) {
    content = content.trim();
  }

  state.line = nextLine;

  // open token
  state.push(name, 1).map = [startLine, state.line];

  const inlineToken = state.push("", 0);
  inlineToken.content = content;
  inlineToken.map = [startLine, state.line];
  inlineToken.children = [];

  // close token
  state.push(name, -1);

  state.parent = oldParent;

  return true;
};

export const textPostHandle: PostInlineRuleHandle = function (state) {
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
    if (tokens[curr].nesting < 0) level--; // closing tag
    tokens[curr].level = level;
    if (tokens[curr].nesting > 0) level++; // opening tag

    if (
      tokens[curr].name === this.name &&
      curr + 1 < max &&
      tokens[curr + 1].name === this.name
    ) {
      // collapse two adjacent text nodes
      tokens[curr + 1].content =
        (tokens[curr].content || "") + (tokens[curr + 1].content || "");
    } else {
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
