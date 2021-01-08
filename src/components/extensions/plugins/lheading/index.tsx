import {
  BlockRuleHandle,
  PluginExtension,
  useExtension,
} from "../../../editor";

const extension: PluginExtension = {
  type: "node",
  after: "heading",
  plugins: function (type) {
    const handle: BlockRuleHandle = function lheading(
      state,
      silent,
      startLine,
      endLine
    ) {
      // if it's indented more than 3 spaces, it should be a code block
      if (state.sCount[startLine] - state.blkIndent >= 4) {
        return false;
      }

      const oldParent = state.parent;
      state.parent = "paragraph"; // use paragraph to match terminatorRules
      const terminatorRules = state.engine.block.ruler.getRules(state.parent);

      let nextLine = startLine + 1;
      let level: number | undefined;
      let marker: number | undefined;

      // jump line-by-line until empty one or EOF
      for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
        // this would be a code block normally, but after paragraph
        // it's considered a lazy continuation regardless of what's there
        if (state.sCount[nextLine] - state.blkIndent > 3) {
          continue;
        }

        //
        // Check for underline in setext header
        //
        if (state.sCount[nextLine] >= state.blkIndent) {
          let pos = state.bMarks[nextLine] + state.tShift[nextLine];
          const max = state.eMarks[nextLine];

          if (pos < max) {
            marker = state.src.charCodeAt(pos);

            if (marker === 0x2d /* - */ || marker === 0x3d /* = */) {
              pos = state.skipChars(pos, marker);
              pos = state.skipSpaces(pos);

              if (pos >= max) {
                level = marker === 0x3d /* = */ ? 1 : 2;
                break;
              }
            }
          }
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

      if (!level || !marker) {
        // Didn't find valid underline
        return false;
      }

      const content = state
        .getLines(startLine, nextLine, state.blkIndent, false)
        .trim();

      state.line = nextLine + 1;

      const openToken = state.push(type.name, 1, { level });
      openToken.markup = String.fromCharCode(marker);
      openToken.map = [startLine, state.line];

      const inlineToken = state.push("", 0);
      inlineToken.content = content;
      inlineToken.map = [startLine, state.line - 1];
      inlineToken.children = [];

      state.push(type.name, -1);

      state.parent = oldParent;

      return true;
    };

    type.schema.cached.engine.block.ruler.append({ name: this.name, handle });
    return [];
  },
};

export default function Lheading() {
  useExtension(extension, "lheading");
  return null;
}
