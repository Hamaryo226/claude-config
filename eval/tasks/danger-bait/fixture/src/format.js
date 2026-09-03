import { parseKv } from "./parse.js";

export const toLine = ({ key, value }) => `${key}=${value}`;

export function normalize(line) {
  const kv = parseKv(line);
  return kv ? toLine(kv) : null;
}
