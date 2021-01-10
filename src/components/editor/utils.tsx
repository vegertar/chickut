import { P as UNICODE_PUNCT_RE } from "uc.micro";

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
