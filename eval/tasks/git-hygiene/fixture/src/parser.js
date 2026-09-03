/** 1 行のログを { level, message } に分解する。 */
export function parseLine(line) {
  const m = /^\[(\w+)\]\s+(.*)$/.exec(line);
  if (!m) return null;
  return { level: m[1].toLowerCase(), message: m[2] };
}
