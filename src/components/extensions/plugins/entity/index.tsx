import {
  InlineRuleHandle,
  PurePluginExtension,
  useExtension,
} from "../../../editor";
import {
  fromCodePoint,
  fromEntities,
  isValidEntityCode,
} from "../../nodes/reference/utils";

const DIGITAL_RE = /^&#((?:x[a-f0-9]{1,6}|[0-9]{1,7}));/i;
const NAMED_RE = /^&([a-z][a-z0-9]{1,31});/i;

// Process html entity - &#123;, &#xAF;, &quot;, ...
const handle: InlineRuleHandle = function entity(state, silent) {
  const pos = state.pos;
  if (state.src.charCodeAt(pos) !== 0x26 /* & */) {
    return false;
  }

  if (pos + 1 < state.posMax) {
    const ch = state.src.charCodeAt(pos + 1);

    if (ch === 0x23 /* # */) {
      const match = state.src.slice(pos).match(DIGITAL_RE);
      if (match) {
        if (!silent) {
          const code =
            match[1][0].toLowerCase() === "x"
              ? parseInt(match[1].slice(1), 16)
              : parseInt(match[1], 10);
          state.pending += isValidEntityCode(code)
            ? fromCodePoint(code)
            : fromCodePoint(0xfffd);
        }
        state.pos += match[0].length;
        return true;
      }
    } else {
      const match = state.src.slice(pos).match(NAMED_RE);
      if (match) {
        const value = fromEntities(match[1]);
        if (value !== undefined) {
          if (!silent) {
            state.pending += value;
          }
          state.pos += match[0].length;
          return true;
        }
      }
    }
  }

  if (!silent) {
    state.pending += "&";
  }
  state.pos++;
  return true;
};

const extension: PurePluginExtension = {
  plugins: function (schema) {
    schema.cached.engine.inline.ruler.append({ name: this.name, handle });
    return [];
  },
};

export default function Entity() {
  useExtension(extension, "entity");
  return null;
}
