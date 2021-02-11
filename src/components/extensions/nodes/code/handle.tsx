import { BlockRuleHandle } from "../../../editor";

// Code block (4 spaces padded)
const handle: BlockRuleHandle = function code(
  state,
  silent,
  startLine,
  endLine
) {
  if (state.sCount[startLine] - state.blkIndent < 4) {
    return false;
  }

  let nextLine = startLine + 1;
  let last = nextLine;

  while (nextLine < endLine) {
    if (state.isEmpty(nextLine)) {
      nextLine++;
      continue;
    }

    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      nextLine++;
      last = nextLine;
      continue;
    }
    break;
  }

  state.line = last;

  state.push(this.name, 1);
  const inline = state.push("", 0);
  inline.code = true;
  inline.lines = state.getLines(startLine, last, 4 + state.blkIndent);
  inline.children = [];
  state.push(this.name, -1);

  return true;
};

export default handle;
