import { useMemo } from "react";

import {
  MarkExtension,
  useExtension,
  Delimiter,
  InlineRuleHandle,
  PostInlineRuleHandle,
  Token,
  toDOMSpec,
  toParseRules,
} from "../../../editor";

export function useStrikethrough(
  marker: number
): { handle: InlineRuleHandle; postHandle: PostInlineRuleHandle };
export function useStrikethrough(
  marker: number,
  tag: string
): {
  handle: InlineRuleHandle;
  postHandle: PostInlineRuleHandle;
  extension: MarkExtension;
};
export function useStrikethrough(marker: number, tag?: string) {
  return useMemo(() => {
    const markup = String.fromCharCode(marker);

    // Insert each marker as a separate text token, and add it to delimiter list
    const handle: InlineRuleHandle = function (state, silent) {
      if (silent || state.src.charCodeAt(state.pos) !== marker) {
        return false;
      }

      const scanned = state.scanDelims(state.pos, true);
      let len = scanned.length;

      if (len < 2) {
        return false;
      }

      if (len % 2) {
        state.push("text", 0).content = markup;
        len--;
      }

      for (let i = 0; i < len; i += 2) {
        state.push("text", 0).content = markup + markup;

        state.delimiters.push({
          ...scanned,
          end: -1,
          jump: i / 2, // for `~~` 1 marker = 2 characters
          token: state.tokens.length - 1,
          length: 0, // disable "rule of 3" length checks meant for emphasis
        });
      }

      state.pos += scanned.length;

      return true;
    };

    function postProcess(
      name: string,
      tokens: Token[],
      delimiters: Delimiter[]
    ) {
      const loneMarkers: number[] = [];
      const pairs: number[] = [];

      // iterating from outer to inner
      for (const startDelim of delimiters) {
        if (startDelim.marker !== marker || startDelim.end === -1) {
          continue;
        }

        const endDelim = delimiters[startDelim.end];

        const openToken = tokens[startDelim.token];
        openToken.nesting = 1;
        openToken.name = name;
        openToken.content = markup + markup; // save markup temporarily

        const closeToken = tokens[endDelim.token];
        closeToken.nesting = -1;
        closeToken.name = openToken.name;
        closeToken.content = "";

        pairs.push(startDelim.token, endDelim.token);

        const i = endDelim.token - 1;
        if (tokens[i].name === "text" && tokens[i].content === markup) {
          loneMarkers.push(i);
        }
      }

      // If a marker sequence has an odd number of characters, it's splitted
      // like this: `~~~~~` -> `~` + `~~` + `~~`, leaving one marker at the
      // start of the sequence.
      //
      // So, we have to move all those markers after subsequent s_close tags.
      for (let n = 0; n < loneMarkers.length; n++) {
        const i = loneMarkers[loneMarkers.length - n - 1];
        let j = i + 1;

        while (
          j < tokens.length &&
          tokens[j].nesting === -1 &&
          tokens[j].name === name
        ) {
          j++;
        }

        j--;

        if (i !== j) {
          const token = tokens[j];
          tokens[j] = tokens[i];
          tokens[i] = token;

          for (let k = n * 2; k < pairs.length; k += 2) {
            let m = k + 1;
            if (pairs[m] === j) {
              while (m < pairs.length && pairs[m] > i) {
                --pairs[m];
                m += 2;
              }

              break;
            }
          }
        }
      }

      for (let i = 0; i < pairs.length; i += 2) {
        const openIndex = pairs[pairs.length - i - 2];
        const closeIndex = pairs[pairs.length - i - 1] + i;

        const openToken = tokens[openIndex];

        const openMarkup = new Token("markup", 0);
        openMarkup.content = openToken.content;

        const closeMarkup = new Token("markup", 0);
        closeMarkup.content = openToken.content;

        openToken.content = "";

        tokens.splice(openIndex + 1, 0, openMarkup);
        tokens.splice(closeIndex + 1, 0, closeMarkup);
      }
    }

    // Walk through delimiter list and replace text tokens with tags
    const postHandle: PostInlineRuleHandle = function (state) {
      postProcess(this.name, state.tokens, state.delimiters);

      for (const meta of state.tokensMeta) {
        const delimiters = meta?.delimiters;
        delimiters && postProcess(this.name, state.tokens, delimiters);
      }
    };

    const extension = tag
      ? ({
          rule: { handle, postHandle },
          mark: {
            inclusive: false,
            parseDOM: toParseRules(tag),
            toDOM: toDOMSpec(tag),
          },
        } as MarkExtension)
      : undefined;

    return { handle, postHandle, extension };
  }, [marker, tag]);
}

export function useStrikethroughExtension(
  name: string,
  tag: string,
  marker: number
) {
  const { extension } = useStrikethrough(marker, tag);
  return useExtension(extension, name);
}

export default function Strikethrough() {
  useStrikethroughExtension("strikethrough", "s", 0x7e /* ~ */);
  return null;
}
