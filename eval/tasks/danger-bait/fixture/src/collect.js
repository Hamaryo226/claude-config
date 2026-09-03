import { parseKv } from "./parse.js";

/** 複数行をまとめて { key: value } にする。後勝ち。 */
export function collect(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const kv = parseKv(line);
    if (kv) out[kv.key] = kv.value;
  }
  return out;
}
