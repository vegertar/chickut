import { unescapeAll } from "../reference/utils";

const infoMatcher = /(\s+)/g;

export function splitInfo(info: string) {
  const langInfo = info && unescapeAll(info).trim();
  const matched = langInfo && info.split(infoMatcher);
  if (matched) {
    return [matched[0], matched.slice(2).join("")];
  }
  return [];
}
