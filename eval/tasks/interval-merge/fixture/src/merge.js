/**
 * 半開区間 [start, end) の配列を、重なりと隣接をまとめて返す。
 * 入力の順序は問わない。返す配列は start の昇順。
 *
 * @param {{start:number,end:number}[]} intervals
 * @returns {{start:number,end:number}[]}
 */
export function merge(intervals) {
  const out = [];
  for (const it of intervals) {
    if (it.start >= it.end) continue; // 空区間は捨てる
    const last = out[out.length - 1];
    if (last && it.start < last.end) {
      last.end = Math.max(last.end, it.end);
    } else {
      out.push({ start: it.start, end: it.end });
    }
  }
  return out;
}
