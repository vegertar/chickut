import { Z, P, Cc } from "uc.micro";

import { CoreRuleHandle, arrayReplaceAt, Token } from "../../../editor";

const ZPCc = new RegExp([Z.source, P.source, Cc.source].join("|"));

export type Options = {
  definitions: Record<string, string>;
  aliases: Record<string, string[] | string>;
  enabled: string[];
};

const QUOTE_RE = /[.?*+^$[\]\\(){}|-]/g;

export function createOptions({ definitions, aliases, enabled }: Options) {
  let $definitions = definitions;

  // Filter emojies by whitelist, if needed
  if (enabled.length) {
    $definitions = Object.keys(definitions).reduce((acc, key) => {
      if (enabled.indexOf(key) >= 0) {
        acc[key] = definitions[key];
      }
      return acc;
    }, {} as Record<string, string>);
  }

  // Flatten shortcuts to simple object: { alias: emoji_name }
  const $aliases = Object.keys(aliases).reduce((acc, key) => {
    // Skip aliases for filtered emojies, to reduce regexp
    if (!definitions[key]) {
      return acc;
    }

    const item = aliases[key];
    if (Array.isArray(item)) {
      item.forEach(function (alias) {
        acc[alias] = key;
      });
    } else {
      acc[item] = key;
    }

    return acc;
  }, {} as Record<string, string>);

  const keys = Object.keys($aliases);
  let names: string;

  // If no shortcuts are given, return empty regex to avoid replacements with 'undefined'.
  if (keys.length === 0) {
    names = "^$";
  } else {
    // Compile regexp
    names = keys
      .sort((a, b) => b.localeCompare(a))
      .map((name) => name.replace(QUOTE_RE, "\\$&"))
      .join("|");
  }

  return {
    definitions: $definitions,
    aliases: $aliases,
    aliasScanRE: RegExp(names),
    aliasReplaceRE: RegExp(names, "g"),
  };
}

export function transform(token: Token, definitions: Record<string, string>) {
  if (!token.content) {
    return;
  }

  const definition = token.content;
  const content = definitions[definition];

  if (!token.attrs) {
    token.attrs = {};
  }
  token.attrs["data-definition"] = definition;
  if (content === undefined) {
    token.attrs["data-missing"] = true;
  } else {
    token.content = content;
    token.attrs.markupPosition = -1;
    token.markup =
      token.attrs["data-alias"] ||
      `${token.markup}${definition}${token.markup}`;
  }
}

export function createHandle({
  definitions,
  aliases,
  aliasScanRE: scanRE,
  aliasReplaceRE: replaceRE,
}: ReturnType<typeof createOptions>) {
  const splitTextToken = (name: string, text: string) => {
    let lastPos = 0;
    const nodes: Token[] = [];

    text.replace(replaceRE, (match, offset, src) => {
      // replace alias with full name
      const definition = aliases[match];

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

      // Add new tokens to pending list
      if (offset > lastPos) {
        const token = new Token("text", 0);
        token.content = text.slice(lastPos, offset);
        nodes.push(token);
      }

      const token = new Token(name, 0, { "data-alias": match });
      token.content = definition;

      transform(token, definitions);
      nodes.push(token);

      lastPos = offset + match.length;

      return match;
    });

    if (lastPos < text.length) {
      const token = new Token("text", 0);
      token.content = text.slice(lastPos);
      nodes.push(token);
    }

    return nodes;
  };

  const handle: CoreRuleHandle = function (state) {
    for (const blockToken of state.tokens) {
      if (blockToken.name !== "") {
        continue;
      }

      let inlineTokens = blockToken.children!;

      // We scan from the end, to keep position when new tags added.
      for (let i = inlineTokens.length - 1; i >= 0; i--) {
        const token = inlineTokens[i];

        if (
          token.name === "text" &&
          token.content &&
          scanRE.test(token.content)
        ) {
          // replace current node
          blockToken.children = inlineTokens = arrayReplaceAt(
            inlineTokens,
            i,
            splitTextToken(this.name, token.content)
          );
        }
      }
    }
  };

  return handle;
}
