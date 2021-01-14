import merge from "lodash.merge";
import pickBy from "lodash.pickby";
import mapKeys from "lodash.mapkeys";
import { DOMOutputSpecArray, ParseRule } from "prosemirror-model";
import { P as UNICODE_PUNCT_RE } from "uc.micro";

import {
  Extension,
  RuleMarkExtension,
  RuleNodeExtension,
  NonRuleMarkExtension,
  NonRuleNodeExtension,
  AfterPluginExtension,
  PurePluginExtension,
} from "./types";

export function isPunctChar(ch: string) {
  return UNICODE_PUNCT_RE.test(ch);
}

export function isSpace(code: number) {
  switch (code) {
    case 0x09:
    case 0x20:
      return true;
  }
  return false;
}

export function isWhiteSpace(code: number) {
  if (code >= 0x2000 && code <= 0x200a) {
    return true;
  }
  switch (code) {
    case 0x09: // \t
    case 0x0a: // \n
    case 0x0b: // \v
    case 0x0c: // \f
    case 0x0d: // \r
    case 0x20:
    case 0xa0:
    case 0x1680:
    case 0x202f:
    case 0x205f:
    case 0x3000:
      return true;
  }
  return false;
}

// Markdown ASCII punctuation characters.
//
// !, ", #, $, %, &, ', (, ), *, +, ,, -, ., /, :, ;, <, =, >, ?, @, [, \, ], ^, _, `, {, |, }, or ~
// http://spec.commonmark.org/0.15/#ascii-punctuation-character
//
// Don't confuse with unicode punctuation !!! It lacks some chars in ascii range.
//
const MD_ASCII_PUNCT_SET = new Set([
  0x21 /* ! */,
  0x22 /* " */,
  0x23 /* # */,
  0x24 /* $ */,
  0x25 /* % */,
  0x26 /* & */,
  0x27 /* ' */,
  0x28 /* ( */,
  0x29 /* ) */,
  0x2a /* * */,
  0x2b /* + */,
  0x2c /* , */,
  0x2d /* - */,
  0x2e /* . */,
  0x2f /* / */,
  0x3a /* : */,
  0x3b /* ; */,
  0x3c /* < */,
  0x3d /* = */,
  0x3e /* > */,
  0x3f /* ? */,
  0x40 /* @ */,
  0x5b /* [ */,
  0x5c /* \ */,
  0x5d /* ] */,
  0x5e /* ^ */,
  0x5f /* _ */,
  0x60 /* ` */,
  0x7b /* { */,
  0x7c /* | */,
  0x7d /* } */,
  0x7e /* ~ */,
]);
export function isMdAsciiPunct(ch: number) {
  return MD_ASCII_PUNCT_SET.has(ch);
}

export function expandTab(n: number) {
  return 4 - (n % 4);
}

export function trimSplit(s: string) {
  let i = 0;
  while (i < s.length && isWhiteSpace(s.charCodeAt(i))) {
    ++i;
  }
  let j = s.length;
  while (j > i && isWhiteSpace(s.charCodeAt(j - 1))) {
    --j;
  }

  return [s.slice(0, i), s.slice(i, j), s.slice(j)];
}

export function getAttrs(node: Element) {
  const attrs = node.attributes;
  return Object.fromEntries(
    [...Array(attrs.length)].map((_, i) => [attrs[i].name, attrs[i].value])
  );
}

export function getDataset(node: HTMLElement, attrs?: Record<string, any>) {
  return {
    ...node.dataset,
    ...attrs,
  };
}

const CAMEL_RE1 = /\W+/g;
const CAMEL_RE2 = /([a-z\d])([A-Z])/g;
const camelToDash = (str: string) =>
  str.replace(CAMEL_RE1, "-").replace(CAMEL_RE2, "$1-$2");

const isNotFalse = (value: any) => value && value !== "false";

export function toDataAttrs(attrs: Record<string, any>) {
  return pickBy(
    mapKeys(attrs, (value, key) => `data-${camelToDash(key)}`),
    isNotFalse
  );
}

export function assign<T extends Record<string, any>>(obj: T, ...srcs: T[]): T {
  srcs.forEach(function (source) {
    if (!source) {
      return;
    }

    for (const key in source) {
      obj[key] = source[key];
    }
  });

  return obj;
}

const tagMatcher = /^(\w+)(\.(\S+))?/;

export function toDOMSpec<T extends { attrs: Record<string, any> }>(
  tag: string,
  attrs?: Record<string, any>
): (node: T) => DOMOutputSpecArray {
  const matched = tag.match(tagMatcher);
  if (!matched) {
    throw new Error(`Invalid tag ${tag} for matcher ${tagMatcher.source}`);
  }
  const [, elementName, , className] = matched;

  return (node) => {
    if (attrs || className || node.attrs) {
      const { class: oldClassName, ...others } = pickBy(
        merge({ ...attrs }, node.attrs),
        isNotFalse
      );
      const newClassName = oldClassName
        ? `${oldClassName} ${className}`
        : className;
      return [elementName, { ...others, class: newClassName }, 0];
    }

    return [elementName, 0];
  };
}

export function toParseRules(tag: string): ParseRule[] {
  return [
    {
      tag,
      getAttrs: (node) => getAttrs(node as Element),
    },
  ];
}

export function mergeExtension<T extends RuleNodeExtension<"block">>(
  a: T,
  b: Partial<T>
): T;
export function mergeExtension<T extends RuleNodeExtension<"inline">>(
  a: T,
  b: Partial<T>
): T;
export function mergeExtension<T extends NonRuleNodeExtension>(
  a: T,
  b: Partial<T>
): T;
export function mergeExtension<T extends RuleMarkExtension>(
  a: T,
  b: Partial<T>
): T;
export function mergeExtension<T extends NonRuleMarkExtension>(
  a: T,
  b: Partial<T>
): T;
export function mergeExtension<T extends AfterPluginExtension<"node">>(
  a: T,
  b: Partial<T>
): T;
export function mergeExtension<T extends AfterPluginExtension<"mark">>(
  a: T,
  b: Partial<T>
): T;
export function mergeExtension<T extends PurePluginExtension>(
  a: T,
  b: Partial<T>
): T;
export function mergeExtension<T extends Extension>(a: T, b: Partial<T>): never;
export function mergeExtension<T extends Extension>(
  { plugins: oldPlugins, ...oldOthers }: T,
  { plugins: newPlugins, ...newOthers }: Partial<T>
) {
  return merge(oldOthers, {
    ...newOthers,
    plugins: function (type: any) {
      return (Array.isArray(oldPlugins)
        ? oldPlugins
        : oldPlugins
        ? (oldPlugins as any).call(this, type)
        : []
      ).concat(
        Array.isArray(newPlugins)
          ? newPlugins
          : newPlugins
          ? (newPlugins as any).call(this, type)
          : []
      );
    },
  } as T);
}

// Remove element from array and put another array at those position.
// Useful for some operations with tokens
export function arrayReplaceAt<T>(src: T[], pos: number, newElements: T[]) {
  return Array<T>().concat(src.slice(0, pos), newElements, src.slice(pos + 1));
}
