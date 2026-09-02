import { test } from "node:test";
import assert from "node:assert/strict";
import { chunk } from "../src/chunk.js";

test("割り切れる件数を分割できる", () => {
  assert.deepEqual(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
});

test("割り切れない件数でも端数を落とさない", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test("size が不正なら例外", () => {
  assert.throws(() => chunk([1], 0), RangeError);
});
