/**
 * @fileoverview microlight - syntax highlightning library
 * @version 0.0.7
 *
 * @license MIT, see http://github.com/asvd/microlight
 * @copyright 2016 asvd <heliosframework@gmail.com>
 *
 * Code structure aims at minimizing the compressed library size
 */

import assign from "lodash.assign";

const WS_RE = /\S/;
const WORD_RE = /[$\w]/;
const OP_RE = /[/{}[(\-+*=<>:;|\\.,?!&@~]/;
const CLOSING_BRACE_RE = /[\])]/;

type Options = {
  codeTag: string;
  tokenTag: string;
  keywords: Set<string>;
};

const defaults: Options = {
  codeTag: "code",
  tokenTag: "span",
  keywords: new Set([
    "abstract",
    "arguments",
    "await",
    "boolean",
    "break",
    "byte",
    "case",
    "catch",
    "char",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "double",
    "else",
    "enum",
    "eval",
    "export",
    "extends",
    "false",
    "final",
    "finally",
    "float",
    "for",
    "function",
    "goto",
    "if",
    "implements",
    "import",
    "in",
    "instanceof",
    "int",
    "interface",
    "let",
    "long",
    "native",
    "new",
    "null",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "short",
    "static",
    "super",
    "switch",
    "synchronized",
    "this",
    "throw",
    "throws",
    "transient",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "volatile",
    "while",
    "with",
    "yield",
  ]),
};

export default function microlight(code: string, options?: Partial<Options>) {
  const { codeTag, tokenTag, keywords } = assign({}, defaults, options);
  const el = document.createElement(codeTag);

  // current token content
  let token = "";

  // current token type:
  //  0: anything else (whitespaces / newlines)
  //  1: operator or brace
  //  2: closing braces (after which '/' is division not regex)
  //  3: (key)word
  //  4: regex
  //  5: string starting with "
  //  6: string starting with '
  //  7: xml comment  <!-- -->
  //  8: multiline comment /* */
  //  9: single-line comment starting with two slashes //
  // 10: single-line comment starting with hash #
  let tokenType = 0;
  let lastTokenType = NaN;

  // current character
  let chr: string | undefined = "1";

  // next character
  let next1 = code[0];

  // previous character
  let prev1: string | undefined;

  // the one before the previous
  let prev2: string | undefined;

  // current position
  let pos = 0;

  // running through characters and highlighting
  while (true) {
    prev2 = prev1;
    prev1 = tokenType < 7 && prev1 === "\\" ? "1" : chr;

    if (!prev1) {
      break;
    }

    chr = next1;
    next1 = code[++pos];

    // flag determining if token is multi-character
    let multichar = token.length > 1;

    if (
      // end of content
      !chr ||
      // types 9-10 (single-line comments) end with a newline
      (tokenType > 8 && chr === "\n") ||
      // 0: whitespaces; merged together
      (tokenType === 0 && WS_RE.test(chr)) ||
      // 1: operators;  consist of a single character
      tokenType === 1 ||
      // 2: braces; consist of a single character
      tokenType === 2 ||
      // 3: (key)word
      (tokenType === 3 && !WORD_RE.test(chr)) ||
      // 4: regex
      (tokenType === 4 && (prev1 === "/" || prev1 === "\n") && multichar) ||
      // 5: string with "
      (tokenType === 5 && prev1 === '"' && multichar) ||
      // 6: string with '
      (tokenType === 6 && prev1 === "'" && multichar) ||
      // 7: xml comment
      (tokenType === 7 && code[pos - 4] + prev2 + prev1 === "-->") ||
      // 8 : multiline comment
      (tokenType === 8 && prev2 + prev1 === "*/")
    ) {
      // appending the token to the result
      if (token) {
        let className = "";
        if (0 < tokenType && tokenType < 3) {
          className = "punctuation";
        } else if (tokenType > 6) {
          className = "comment";
        } else if (tokenType > 3) {
          className = "string";
        } else if (keywords.has(token)) {
          className = "keyword";
        }

        const node = document.createElement(tokenTag);
        node.appendChild(document.createTextNode(token));
        className && node.classList.add(className);
        el.appendChild(node);
      }

      // saving the previous token type (skipping whitespaces and comments)
      lastTokenType = tokenType && tokenType < 7 ? tokenType : lastTokenType;

      // initializing a new token
      token = "";

      // determining the new token type (going up the list until matching a token type start condition)
      tokenType = 11;

      let ok = false;
      while (!ok) {
        switch (--tokenType) {
          case 0: // whitespace
            ok = true;
            break;
          case 1: // operator or braces
            ok = OP_RE.test(chr);
            break;
          case 2: // closing brace
            ok = CLOSING_BRACE_RE.test(chr);
            break;
          case 3: // (key)word
            ok = WORD_RE.test(chr);
            break;
          case 4: // regex
            ok =
              chr === "/" &&
              // previous token was an opening brace or an operator (otherwise division, not a regex)
              lastTokenType < 2 &&
              // workaround for xml closing tags
              prev1 !== "<";
            break;
          case 5: // string with "
            ok = chr === '"';
            break;
          case 6: // string with '
            ok = chr === "'";
            break;
          case 7: // xml comment
            ok = chr + next1 + code[pos + 1] + code[pos + 2] === "<!--";
            break;
          case 8: // multiline comment
            ok = chr + next1 === "/*";
            break;
          case 9: // single-line comment
            ok = chr + next1 === "//";
            break;
          case 10: // hash-style comment
            ok = chr === "#";
            break;
        }
      }
    }

    token += chr;
  }

  return el;
}
