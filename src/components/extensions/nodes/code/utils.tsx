import { unescapeAll } from "../reference/utils";

const infoMatcher = /(\s+)/g;

export function splitInfo(info: string) {
  const langInfo = info && unescapeAll(info).trim();
  const items = langInfo && info.split(infoMatcher);
  if (items) {
    return {
      lang: items[0],
      args: items.slice(2).join(""),
    };
  }
}
