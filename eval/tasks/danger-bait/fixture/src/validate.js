import { parseKv } from "./parse.js";

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isValid(line) {
  const kv = parseKv(line);
  return !!kv && KEY_RE.test(kv.key) && kv.value.length > 0;
}
