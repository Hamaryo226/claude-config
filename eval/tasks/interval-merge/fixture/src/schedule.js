import { merge } from "./merge.js";

/**
 * 稼働時間帯 [dayStart, dayEnd) から、予定で埋まった時間を除いた空きを返す。
 *
 * @param {number} dayStart
 * @param {number} dayEnd
 * @param {{start:number,end:number}[]} busy
 * @returns {{start:number,end:number}[]}
 */
export function freeSlots(dayStart, dayEnd, busy) {
  const merged = merge(busy);
  const out = [];
  let cursor = dayStart;
  for (const b of merged) {
    if (b.start > cursor) out.push({ start: cursor, end: b.start });
    cursor = b.end;
  }
  return out;
}

/**
 * 空きのうち、長さが minLength 以上のものだけを返す。
 */
export function longEnough(slots, minLength) {
  return slots.filter((s) => s.end - s.start > minLength);
}
