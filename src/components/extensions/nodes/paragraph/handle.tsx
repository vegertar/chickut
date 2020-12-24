import { BlockRuleHandle } from "../../../editor";

const handle: BlockRuleHandle = function paragraph(state, silent, startLine) {
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

export default handle;
