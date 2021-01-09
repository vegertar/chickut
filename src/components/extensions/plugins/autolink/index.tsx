import {
  InlineRuleHandle,
  PluginExtension,
  useExtension,
} from "../../../editor";
import {
  normalizeLink,
  normalizeLinkText,
  validateLink,
} from "../../nodes/reference/utils";

const EMAIL_RE = /^([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;
// eslint-disable-next-line no-control-regex
const AUTOLINK_RE = /^([a-zA-Z][a-zA-Z0-9+.-]{1,31}):([^<>\x00-\x20]*)$/;

// Process autolinks '<protocol:...>'
const extension: PluginExtension = {
  type: "mark",
  after: "link",
  plugins: function (type) {
    const name = this.name;
    const handle: InlineRuleHandle = function autolink(state, silent) {
      let pos = state.pos;
      if (state.src.charCodeAt(pos) !== 0x3c /* < */) {
        return false;
      }

      const start = state.pos;
      const max = state.posMax;

      for (;;) {
        if (++pos >= max) {
          return false;
        }

        const ch = state.src.charCodeAt(pos);

        if (ch === 0x3c /* < */) {
          return false;
        }
        if (ch === 0x3e /* > */) {
          break;
        }
      }

      const url = state.src.slice(start + 1, pos);

      if (AUTOLINK_RE.test(url)) {
        const fullUrl = normalizeLink(url);
        if (!validateLink(fullUrl)) {
          return false;
        }

        if (!silent) {
          state.push(type.name, 1, { href: fullUrl }).markup = name;
          state.push("text", 0).content = normalizeLinkText(url);
          state.push(type.name, -1);
        }

        state.pos += url.length + 2;
        return true;
      }

      if (EMAIL_RE.test(url)) {
        const fullUrl = normalizeLink("mailto:" + url);
        if (!validateLink(fullUrl)) {
          return false;
        }

        if (!silent) {
          state.push(type.name, 1, { href: fullUrl }).markup = name;
          state.push("text", 0).content = normalizeLinkText(url);
          state.push(type.name, -1);
        }

        state.pos += url.length + 2;
        return true;
      }

      return false;
    };

    type.schema.cached.engine.inline.ruler.append({ name, handle });
    return [];
  },
};

export default function Autolink() {
  useExtension(extension, "autolink");
  return null;
}
