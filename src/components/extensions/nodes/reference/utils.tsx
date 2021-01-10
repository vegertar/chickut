import mdurl from "mdurl";
import punycode from "punycode/";
import entities from "entities/lib/maps/entities.json";

const UNESCAPE_MD_RE = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
const ENTITY_RE = /&([a-z#][a-z0-9]{1,31});/gi;
const UNESCAPE_ALL_RE = new RegExp(
  UNESCAPE_MD_RE.source + "|" + ENTITY_RE.source,
  "gi"
);
const DIGITAL_ENTITY_TEST_RE = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))/i;

export function isValidEntityCode(c: number) {
  /*eslint no-bitwise:0*/
  // broken sequence
  if (c >= 0xd800 && c <= 0xdfff) {
    return false;
  }
  // never used
  if (c >= 0xfdd0 && c <= 0xfdef) {
    return false;
  }
  if ((c & 0xffff) === 0xffff || (c & 0xffff) === 0xfffe) {
    return false;
  }
  // control codes
  if (c >= 0x00 && c <= 0x08) {
    return false;
  }
  if (c === 0x0b) {
    return false;
  }
  if (c >= 0x0e && c <= 0x1f) {
    return false;
  }
  if (c >= 0x7f && c <= 0x9f) {
    return false;
  }
  // out of range
  if (c > 0x10ffff) {
    return false;
  }
  return true;
}

export function fromCodePoint(c: number) {
  /*eslint no-bitwise:0*/
  if (c > 0xffff) {
    c -= 0x10000;
    var surrogate1 = 0xd800 + (c >> 10),
      surrogate2 = 0xdc00 + (c & 0x3ff);

    return String.fromCharCode(surrogate1, surrogate2);
  }
  return String.fromCharCode(c);
}

export function fromEntities(name: string) {
  if (Object.prototype.hasOwnProperty.call(entities, name)) {
    return entities[name as keyof typeof entities];
  }
  return undefined;
}

function replaceEntityPattern(match: string, name: keyof typeof entities) {
  const value = fromEntities(name);
  if (value !== undefined) {
    return value;
  }

  if (
    name.charCodeAt(0) === 0x23 /* # */ &&
    DIGITAL_ENTITY_TEST_RE.test(name)
  ) {
    const code =
      name[1].toLowerCase() === "x"
        ? parseInt(name.slice(2), 16)
        : parseInt(name.slice(1), 10);

    if (isValidEntityCode(code)) {
      return fromCodePoint(code);
    }
  }

  return match;
}

export function unescapeAll(str: string) {
  if (str.indexOf("\\") < 0 && str.indexOf("&") < 0) {
    return str;
  }

  return str.replace(
    UNESCAPE_ALL_RE,
    (match, escaped, entity) => escaped || replaceEntityPattern(match, entity)
  );
}

// Hepler to unify [reference labels].
export function normalizeReference(str: string) {
  // Trim and collapse whitespace
  //
  str = str.trim().replace(/\s+/g, " ");

  // In node v10 'ẞ'.toLowerCase() === 'Ṿ', which is presumed to be a bug
  // fixed in v12 (couldn't find any details).
  //
  // So treat this one as a special case
  // (remove this when node v10 is no longer supported).
  //
  if ("ẞ".toLowerCase() === "Ṿ") {
    str = str.replace(/ẞ/g, "ß");
  }

  // .toLowerCase().toUpperCase() should get rid of all differences
  // between letter variants.
  //
  // Simple .toLowerCase() doesn't normalize 125 code points correctly,
  // and .toUpperCase doesn't normalize 6 of them (list of exceptions:
  // İ, ϴ, ẞ, Ω, K, Å - those are already uppercased, but have differently
  // uppercased versions).
  //
  // Here's an example showing how it happens. Lets take greek letter omega:
  // uppercase U+0398 (Θ), U+03f4 (ϴ) and lowercase U+03b8 (θ), U+03d1 (ϑ)
  //
  // Unicode entries:
  // 0398;GREEK CAPITAL LETTER THETA;Lu;0;L;;;;;N;;;;03B8;
  // 03B8;GREEK SMALL LETTER THETA;Ll;0;L;;;;;N;;;0398;;0398
  // 03D1;GREEK THETA SYMBOL;Ll;0;L;<compat> 03B8;;;;N;GREEK SMALL LETTER SCRIPT THETA;;0398;;0398
  // 03F4;GREEK CAPITAL THETA SYMBOL;Lu;0;L;<compat> 0398;;;;N;;;;03B8;
  //
  // Case-insensitive comparison should treat all of them as equivalent.
  //
  // But .toLowerCase() doesn't change ϑ (it's already lowercase),
  // and .toUpperCase() doesn't change ϴ (already uppercase).
  //
  // Applying first lower then upper case normalizes any character:
  // '\u0398\u03f4\u03b8\u03d1'.toLowerCase().toUpperCase() === '\u0398\u0398\u0398\u0398'
  //
  // Note: this is equivalent to unicode case folding; unicode normalization
  // is a different step that is not required here.
  //
  // Final result should be uppercased, because it's later stored in an object
  // (this avoid a conflict with Object.prototype members,
  // most notably, `__proto__`)
  //
  return str.toLowerCase().toUpperCase();
}

export function parseLinkTitle(str: string, pos: number, max: number) {
  const start = pos;
  const result = {
    ok: false,
    pos: 0,
    lines: 0,
    str: "",
  };

  if (pos >= max) {
    return result;
  }

  let marker = str.charCodeAt(pos);

  if (
    marker !== 0x22 /* " */ &&
    marker !== 0x27 /* ' */ &&
    marker !== 0x28 /* ( */
  ) {
    return result;
  }

  pos++;

  // if opening marker is "(", switch it to closing marker ")"
  if (marker === 0x28) {
    marker = 0x29;
  }

  let lines = 0;
  while (pos < max) {
    const code = str.charCodeAt(pos);
    if (code === marker) {
      result.pos = pos + 1;
      result.lines = lines;
      result.str = unescapeAll(str.slice(start + 1, pos));
      result.ok = true;
      return result;
    } else if (code === 0x28 /* ( */ && marker === 0x29 /* ) */) {
      return result;
    } else if (code === 0x0a) {
      lines++;
    } else if (code === 0x5c /* \ */ && pos + 1 < max) {
      pos++;
      if (str.charCodeAt(pos) === 0x0a) {
        lines++;
      }
    }

    pos++;
  }

  return result;
}

export function parseLinkDestination(str: string, pos: number, max: number) {
  const start = pos;
  const result = {
    ok: false,
    pos: 0,
    lines: 0,
    str: "",
  };

  if (str.charCodeAt(pos) === 0x3c /* < */) {
    pos++;
    while (pos < max) {
      const code = str.charCodeAt(pos);
      if (code === 0x0a /* \n */) {
        return result;
      }
      if (code === 0x3c /* < */) {
        return result;
      }
      if (code === 0x3e /* > */) {
        result.pos = pos + 1;
        result.str = unescapeAll(str.slice(start + 1, pos));
        result.ok = true;
        return result;
      }
      if (code === 0x5c /* \ */ && pos + 1 < max) {
        pos += 2;
        continue;
      }

      pos++;
    }

    // no closing '>'
    return result;
  }

  // this should be ... } else { ... branch

  let level = 0;
  while (pos < max) {
    const code = str.charCodeAt(pos);

    if (code === 0x20) {
      break;
    }

    // ascii control characters
    if (code < 0x20 || code === 0x7f) {
      break;
    }

    if (code === 0x5c /* \ */ && pos + 1 < max) {
      if (str.charCodeAt(pos + 1) === 0x20) {
        break;
      }
      pos += 2;
      continue;
    }

    if (code === 0x28 /* ( */) {
      level++;
      if (level > 32) {
        return result;
      }
    }

    if (code === 0x29 /* ) */) {
      if (level === 0) {
        break;
      }
      level--;
    }

    pos++;
  }

  if (start === pos) {
    return result;
  }
  if (level !== 0) {
    return result;
  }

  result.str = unescapeAll(str.slice(start, pos));
  result.lines = 0;
  result.pos = pos;
  result.ok = true;
  return result;
}

// This validator can prohibit more than really needed to prevent XSS. It's a
// tradeoff to keep code simple and to be secure by default.
//
// If you need different setup - override validator method as you wish. Or
// replace it with dummy function and use external sanitizer.
const BAD_PROTO_RE = /^(vbscript|javascript|file|data):/;
const GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;

export function validateLink(url: string) {
  // url should be normalized at this point, and existing entities are decoded
  const str = url.trim().toLowerCase();
  return BAD_PROTO_RE.test(str) ? GOOD_DATA_RE.test(str) : true;
}

const RECODE_HOSTNAME_FOR = ["http:", "https:", "mailto:"];

export function normalizeLink(url: string) {
  var parsed = mdurl.parse(url, true);

  if (parsed.hostname) {
    // Encode hostnames in urls like:
    // `http://host/`, `https://host/`, `mailto:user@host`, `//host/`
    //
    // We don't encode unknown schemas, because it's likely that we encode
    // something we shouldn't (e.g. `skype:name` treated as `skype:host`)
    //
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
      try {
        parsed.hostname = punycode.toASCII(parsed.hostname);
      } catch (er) {
        /**/
      }
    }
  }

  return mdurl.encode(mdurl.format(parsed));
}

export function normalizeLinkText(url: string) {
  const parsed = mdurl.parse(url, true);

  if (parsed.hostname) {
    // Encode hostnames in urls like:
    // `http://host/`, `https://host/`, `mailto:user@host`, `//host/`
    //
    // We don't encode unknown schemas, because it's likely that we encode
    // something we shouldn't (e.g. `skype:name` treated as `skype:host`)
    //
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
      try {
        parsed.hostname = punycode.toUnicode(parsed.hostname);
      } catch (er) {
        /**/
      }
    }
  }

  // add '%' to exclude list because of https://github.com/markdown-it/markdown-it/issues/720
  return mdurl.decode(mdurl.format(parsed), mdurl.decode.defaultChars + "%");
}
