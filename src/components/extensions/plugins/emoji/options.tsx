import { useMemo } from "react";

import { assign } from "../../../editor";

import full from "./data/full.json";
import shortcuts from "./data/shortcuts";

export type Options = {
  emojies: Record<string, string>;
  shortcuts: Record<string, string[] | string>;
  enabled: string[];
};

const defaults: Options = {
  emojies: full,
  shortcuts,
  enabled: [],
};

const QUOTE_RE = /[.?*+^$[\]\\(){}|-]/g;

export function useOptions(options?: Options) {
  const { emojies, shortcuts, enabled } = useMemo(
    () => assign({}, defaults, options || {}) as Options,
    [options]
  );

  return useMemo(() => {
    let $emojies = emojies;

    // Filter emojies by whitelist, if needed
    if (enabled.length) {
      $emojies = Object.keys(emojies).reduce((acc, key) => {
        if (enabled.indexOf(key) >= 0) {
          acc[key] = emojies[key];
        }
        return acc;
      }, {} as Record<string, string>);
    }

    // Flatten shortcuts to simple object: { alias: emoji_name }
    const $shortcuts = Object.keys(shortcuts).reduce((acc, key) => {
      // Skip aliases for filtered emojies, to reduce regexp
      if (!emojies[key]) {
        return acc;
      }

      const item = shortcuts[key];
      if (Array.isArray(item)) {
        item.forEach(function (alias) {
          acc[alias] = key;
        });
      } else {
        acc[item] = key;
      }

      return acc;
    }, {} as Record<string, string>);

    const keys = Object.keys(emojies);
    let names: string;

    // If no definitions are given, return empty regex to avoid replacements with 'undefined'.
    if (keys.length === 0) {
      names = "^$";
    } else {
      // Compile regexp
      names = keys
        .map((name) => `:${name}:`)
        .concat(Object.keys($shortcuts))
        .sort((a, b) => b.localeCompare(a))
        .map((name) => name.replace(QUOTE_RE, "\\$&"))
        .join("|");
    }

    return {
      emojies: $emojies,
      shortcuts: $shortcuts,
      scanRE: RegExp(names),
      replaceRE: RegExp(names, "g"),
    };
  }, [emojies, shortcuts, enabled]);
}
