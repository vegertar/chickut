import { useCallback, useMemo, useRef } from "react";
import { Z, P, Cc } from "uc.micro";

import { PurePluginExtension, Token, useExtension } from "../../../editor";

import { useOptions, Options } from "./options";

const ZPCc = new RegExp([Z.source, P.source, Cc.source].join("|"));

export default function Emoji(options?: Options) {
  const opts = useOptions(options);
  const applyEmojiesRef = useRef<(token: Token) => void>();

  applyEmojiesRef.current = useCallback(
    (token: Token) => {
      if (token.name !== "text" || !token.content) {
        return;
      }

      token.content = token.content.replace(
        opts.replaceRE,
        (match, offset: number, src: string) => {
          let emojiName: string;

          // Validate emoji name
          if (opts.shortcuts.hasOwnProperty(match)) {
            // replace shortcut with full name
            emojiName = opts.shortcuts[match];

            // Don't allow letters before any shortcut (as in no ":/" in http://)
            if (offset > 0 && !ZPCc.test(src[offset - 1])) {
              return match;
            }

            // Don't allow letters after any shortcut
            if (
              offset + match.length < src.length &&
              !ZPCc.test(src[offset + match.length])
            ) {
              return match;
            }
          } else {
            emojiName = match.slice(1, -1);
          }

          return opts.emojies[emojiName];
        }
      );
    },
    [opts]
  );

  const extension = useMemo<PurePluginExtension>(
    () => ({
      plugins: function (schema) {
        schema.cached.engine.postInline.ruler.append({
          name: this.name,
          handle: function emoji(state) {
            const fn = applyEmojiesRef.current;
            if (!fn) {
              return;
            }

            for (const token of state.tokens) {
              fn(token);
            }
          },
        });
        return [];
      },
    }),
    []
  );

  useExtension(extension, "emoji");

  return null;
}
