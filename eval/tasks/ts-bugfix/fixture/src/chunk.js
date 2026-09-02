/**
 * 配列を size 件ずつの塊に分ける。
 * @param {unknown[]} items
 * @param {number} size
 * @returns {unknown[][]}
 */
export function chunk(items, size) {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError("size は 1 以上の整数であること");
  }
  const out = [];
  // 端数が出る位置まで進める
  for (let i = 0; i + size <= items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
