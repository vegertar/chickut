const attrName = "[a-zA-Z_:][a-zA-Z0-9:._-]*";

const unquoted = "[^\"'=<>`\\x00-\\x20]+";
const singleQuoted = "'[^']*'";
const doubleQuoted = '"[^"]*"';
const attrValue = `(?:${unquoted}|${singleQuoted}|${doubleQuoted})`;

const attribute = `(?:\\s+${attrName}(?:\\s*=\\s*${attrValue})?)`;
const openTag = "<[A-Za-z][A-Za-z0-9\\-]*" + attribute + "*\\s*\\/?>";
const closeTag = "<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>";
const comment = "<!---->|<!--(?:-?[^>-])(?:-?[^-])*-->";
const processing = "<[?][\\s\\S]*?[?]>";
const declaration = "<![A-Z]+\\s+[^>]*>";
const cdata = "<!\\[CDATA\\[[\\s\\S]*?\\]\\]>";

export const HTML_TAG_RE = new RegExp(
  `^(?:${openTag}|${closeTag}|${comment}|${processing}|${declaration}|${cdata})`
);
export const HTML_OPEN_CLOSE_TAG_RE = new RegExp(`^(?:${openTag}|${closeTag})`);
