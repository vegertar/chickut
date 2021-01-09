import {
  InlineRuleHandle,
  PurePluginExtension,
  useExtension,
  isSpace,
} from "../../../editor";

const extension: PurePluginExtension = {
  plugins: function (schema) {
    const ESCAPED = Array(256).fill(0);
    "\\!\"#$%&'()*+,./:;<=>?@[]^_`{|}~-".split("").forEach((ch) => {
      ESCAPED[ch.charCodeAt(0)] = 1;
    });

    const newline = schema.nodes.newline;
    const newlineName =
      newline && newline.isInline && newline.isLeaf ? newline.name : null;

    const handle: InlineRuleHandle = function escape(state, silent) {
      let pos = state.pos;
      const max = state.posMax;

      if (state.src.charCodeAt(pos) !== 0x5c /* \ */) {
        return false;
      }

      pos++;

      if (pos < max) {
        const ch = state.src.charCodeAt(pos);
        if (ch < 256 && ESCAPED[ch] !== 0) {
          if (!silent) {
            state.pending += state.src[pos];
          }

          state.pos += 2;
          return true;
        }

        if (ch === 0x0a) {
          if (!silent && newlineName) {
            state.push(newlineName, 0);
          }

          pos++;

          // skip leading whitespaces from next line
          while (pos < max && isSpace(state.src.charCodeAt(pos))) {
            pos++;
          }

          state.pos = pos;
          return true;
        }
      }

      if (!silent) {
        state.pending += "\\";
      }
      state.pos++;
      return true;
    };

    schema.cached.engine.inline.ruler.append({ name: this.name, handle });
    return [];
  },
};

export default function Escape() {
  useExtension(extension, "escape");
  return null;
}
