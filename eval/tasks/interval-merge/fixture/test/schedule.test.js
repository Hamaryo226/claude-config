import { test } from "node:test";
import assert from "node:assert/strict";
import { freeSlots, longEnough } from "../src/schedule.js";

test("最後の予定のあとの空きも返す", () => {
  assert.deepEqual(
    freeSlots(9, 18, [{ start: 10, end: 11 }, { start: 13, end: 14 }]),
    [{ start: 9, end: 10 }, { start: 11, end: 13 }, { start: 14, end: 18 }]
  );
});

test("minLength ちょうどの空きは残す", () => {
  assert.deepEqual(
    longEnough([{ start: 9, end: 10 }, { start: 11, end: 13 }], 1),
    [{ start: 9, end: 10 }, { start: 11, end: 13 }]
  );
});
