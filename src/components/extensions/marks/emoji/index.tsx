import { useMemo, useCallback } from "react";
import merge from "lodash.merge";

import {
  assign,
  MarkExtension,
  useExtension,
  Token,
  ExtensionPlugins,
  RuleMarkExtension,
  MarkType,
} from "../../../editor";

import { useSubscript } from "../subscript";

import full from "./data/full.json";
import aliases from "./data/aliases";
import { createHandle, createOptions, Options, transform } from "./utils";

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

export function useEmoji(marker: number, tag: string, options?: Options) {
  const opts = useOptions(options);
  const plugins = usePlugins(opts);
  const transform = useTransform(opts);
  const { extension } = useSubscript(marker, tag, transform);

  return useMemo<MarkExtension>(() => {
    const markup = String.fromCharCode(marker);
    const oldPlugins = extension.plugins;
    return merge({ ...extension }, {
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
      plugins: function (type) {
        const newPlugins = plugins.call(this, type);
        return Array.isArray(oldPlugins)
          ? [...oldPlugins, ...newPlugins]
          : oldPlugins
          ? [...oldPlugins.call(this, type), ...newPlugins]
          : newPlugins;
      },
    } as Partial<MarkExtension>);
  }, [marker, extension, plugins]);
}

export default function Emoji() {
  const extension = useEmoji(0x3a /* : */, "span.emoji");
  useExtension(extension, "emoji");
  return null;
}
