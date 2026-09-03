import { collect } from "./collect.js";
import { isValid } from "./validate.js";

export function summarize(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  const valid = lines.filter(isValid).length;
  return { total: lines.length, valid, keys: Object.keys(collect(text)).length };
}
