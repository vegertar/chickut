/**
 * @fileoverview microlight - syntax highlightning library
 * @version 0.0.7
 *
 * @license MIT, see http://github.com/asvd/microlight
 * @copyright 2016 asvd <heliosframework@gmail.com>
 *
 * Code structure aims at minimizing the compressed library size
 */

const WS_RE = /\S/;
const WORD_RE = /[$\w]/;
const KEYWORD_RE = /^(a(bstract|lias|nd|rguments|rray|s(m|sert)?|uto)|b(ase|egin|ool(ean)?|reak|yte)|c(ase|atch|har|hecked|lass|lone|ompl|onst|ontinue)|de(bugger|cimal|clare|f(ault|er)?|init|l(egate|ete)?)|do|double|e(cho|ls?if|lse(if)?|nd|nsure|num|vent|x(cept|ec|p(licit|ort)|te(nds|nsion|rn)))|f(allthrough|alse|inal(ly)?|ixed|loat|or(each)?|riend|rom|unc(tion)?)|global|goto|guard|i(f|mp(lements|licit|ort)|n(it|clude(_once)?|line|out|stanceof|t(erface|ernal)?)?|s)|l(ambda|et|ock|ong)|m(icrolight|odule|utable)|NaN|n(amespace|ative|ext|ew|il|ot|ull)|o(bject|perator|r|ut|verride)|p(ackage|arams|rivate|rotected|rotocol|ublic)|r(aise|e(adonly|do|f|gister|peat|quire(_once)?|scue|strict|try|turn))|s(byte|ealed|elf|hort|igned|izeof|tatic|tring|truct|ubscript|uper|ynchronized|witch)|t(emplate|hen|his|hrows?|ransient|rue|ry|ype(alias|def|id|name|of))|u(n(checked|def(ined)?|ion|less|signed|til)|se|sing)|v(ar|irtual|oid|olatile)|w(char_t|hen|here|hile|ith)|xor|yield)$/;
const OP_RE = /[/{}[(\-+*=<>:;|\\.,?!&@~]/;
const CLOSING_BRACE_RE = /[\])]/;

export default function microlight(microlighted: HTMLCollectionOf<Element>) {
  for (const el of microlighted) {
    const text = el.textContent;
    if (!text) {
      continue;
    }

    // cleaning the node
    el.innerHTML = "";

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
    let next1 = text[0];

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
      next1 = text[++pos];

      // flag determining if token is multi-character
      let multichar = token.length > 1;

      if (
        !chr || // end of content
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
        (tokenType === 7 && text[pos - 4] + prev2 + prev1 === "-->") ||
        // 8 : multiline comment
        (tokenType === 8 && prev2 + prev1 === "*/")
      ) {
        // appending the token to the result
        if (token) {
          // remapping token type into style (some types are highlighted similarly)
          const node = document.createElement("span");
          el.appendChild(node);

          const classType = !tokenType
            ? 0 // not formatted
            : tokenType < 3
            ? 2 // punctuation
            : tokenType > 6
            ? 4 // comments
            : tokenType > 3
            ? 3 // regex and strings
            : +KEYWORD_RE.test(token); // otherwise tokenType == 3, (key)word (1 if regexp matches, 0 otherwise)

          switch (classType) {
            case 1:
              node.classList.add("keyword");
              break;
            case 2:
              node.classList.add("punctuation");
              break;
            case 3:
              node.classList.add("string");
              break;
            case 4:
              node.classList.add("comments");
              break;
          }

          node.appendChild(document.createTextNode(token));
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
              ok = chr + next1 + text[pos + 1] + text[pos + 2] === "<!--";
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
  }
}
