import { useMemo, useCallback } from "react";

import {
  assign,
  useExtension,
  Token,
  ExtensionPlugins,
  RuleMarkExtension,
  MarkType,
  mergeExtension,
} from "../../../editor";

import { useSubscript } from "../subscript";

import full from "./data/full.json";
import aliases from "./data/aliases";
import { createHandle, createOptions, Options, transform } from "./utils";

import "./style.scss";

const defaults: Options = {
  definitions: full,
  aliases: aliases,
  enabled: [],
};

function useOptions(options?: Options) {
  const { definitions, aliases, enabled } = assign(
    {},
    defaults,
    options || {}
  ) as Options;

  return useMemo(() => createOptions({ definitions, aliases, enabled }), [
    definitions,
    aliases,
    enabled,
  ]);
}

function useTransform({ definitions }: Pick<Options, "definitions">) {
  return useCallback((token: Token) => transform(token, definitions), [
    definitions,
  ]);
}

function usePlugins(options: ReturnType<typeof useOptions>) {
  const handle = useMemo(() => createHandle(options), [options]);
  return useCallback<ExtensionPlugins<RuleMarkExtension, MarkType>>(
    function (type) {
      type.schema.cached.engine.core.ruler.append({
        name: this.name,
        handle,
      });
      return [];
    },
    [handle]
  );
}

export function useEmoji(
  marker: number,
  tag: string,
  options?: Options
): {
  plugins: ReturnType<typeof usePlugins>;
  handle: ReturnType<typeof useSubscript>["handle"];
  extension: NonNullable<ReturnType<typeof useSubscript>["extension"]>;
};
export function useEmoji(
  marker: number,
  tag: string | undefined,
  options?: Options
): {
  plugins: ReturnType<typeof usePlugins>;
  handle: ReturnType<typeof useSubscript>["handle"];
  extension: ReturnType<typeof useSubscript>["extension"];
};
export function useEmoji(marker: number, tag?: string, options?: Options) {
  const opts = useOptions(options);
  const plugins = usePlugins(opts);
  const transform = useTransform(opts);
  const { handle, extension } = useSubscript(marker, tag, transform);

  return {
    plugins,
    handle,
    extension: useMemo(() => {
      if (!extension) {
        return undefined;
      }

      const markup = String.fromCharCode(marker);
      return mergeExtension(extension, {
        plugins,
        mark: {
          attrs: {
            "data-definition": {},
            "data-alias": { default: "" },
            "data-missing": { default: false },
          },
          toText: ({ attrs }) =>
            `${
              attrs["data-alias"] ||
              `${markup}${attrs["data-definition"]}${markup}`
            }`,
        },
      });
    }, [marker, extension, plugins]),
  };
}

export function useEmojiExtension(
  name: string,
  tag: string,
  marker: number,
  options?: Options
) {
  const { extension } = useEmoji(marker, tag, options);
  return useExtension(extension, name);
}

export default function Emoji() {
  useEmojiExtension("emoji", "span.emoji", 0x3a /* : */);
  return null;
}
