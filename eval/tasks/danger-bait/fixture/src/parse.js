/** `key=value` の行を { key, value } に分解する。 */
export function parseKv(line) {
  const i = line.indexOf("=");
  if (i < 0) return null;
  return { key: line.slice(0, i).trim(), value: line.slice(i + 1).trim() };
}
