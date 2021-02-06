import { useMemo } from "react";
import {
  useExtension,
  InlineRuleHandle,
  toDOMSpec,
  RuleMarkExtension,
  Token,
  toParseRules,
} from "../../../editor";

// same as UNESCAPE_MD_RE plus a space
const UNESCAPE_RE = /\\([ \\!"#$%&'()*+,./:;<=>?@[\]^_`{|}~-])/g;
const UNESCAPED_SPACES_RE = /(^|[^\\])(\\\\)*\s/;

type Transform = (tokens: Token[]) => void;

export function useSubscript(marker: number): { handle: InlineRuleHandle };
export function useSubscript(
  marker: number,
  tag: string,
  transform?: Transform
): {
  handle: InlineRuleHandle;
  extension: RuleMarkExtension;
};
export function useSubscript(
  marker: number,
  tag: string | undefined,
  transform: Transform
): { handle: InlineRuleHandle; extension?: RuleMarkExtension };
export function useSubscript(
  marker: number,
  tag?: string,
  transform?: Transform
) {
  return useMemo(() => {
    const markup = String.fromCharCode(marker);
    const handle: InlineRuleHandle = function (state, silent) {
      // don't run any pairs in validation mode
      if (silent) {
        return false;
      }

      const start = state.pos;
      if (state.src.charCodeAt(start) !== marker) {
        return false;
      }

      const max = state.posMax;
      if (start + 2 >= max) {
        return false;
      }

      let found = false;
      state.pos = start + 1;

      while (state.pos < max) {
        if (state.src.charCodeAt(state.pos) === marker) {
          found = true;
          break;
        }

        state.engine.inline.skipToken(state);
      }

      if (!found || start + 1 === state.pos) {
        state.pos = start;
        return false;
      }

      const content = state.src.slice(start + 1, state.pos);

      // don't allow unescaped spaces/newlines inside
      if (content.match(UNESCAPED_SPACES_RE)) {
        state.pos = start;
        return false;
      }

      // found!
      state.posMax = state.pos;
      state.pos = start + 1;

      const openToken = state.push(this.name, 1);
      const openMarkup = state.push("markup", 0);
      openMarkup.content = markup;

      const token = state.push("text", 0);
      token.code = true;
      token.content = content.replace(UNESCAPE_RE, "$1");

      const closeMarkup = state.push("markup", 0);
      closeMarkup.content = markup;
      const closeToken = state.push(this.name, -1);

      transform?.([openToken, openMarkup, token, closeMarkup, closeToken]);

      state.pos = state.posMax + 1;
      state.posMax = max;
      return true;
    };

    const extension = tag
      ? ({
          rule: { handle },
          mark: {
            inclusive: false,
            parseDOM: toParseRules(tag),
            toDOM: toDOMSpec(tag),
          },
        } as RuleMarkExtension)
      : undefined;

    return { handle, extension };
  }, [marker, tag, transform]);
}

export function useSubscriptExtension(
  name: string,
  tag: string,
  marker: number
) {
  const { extension } = useSubscript(marker, tag);
  return useExtension(extension, name);
}

export default function Subscript() {
  useSubscriptExtension("subscript", "sub", 0x7e /* ~ */);
  return null;
}
