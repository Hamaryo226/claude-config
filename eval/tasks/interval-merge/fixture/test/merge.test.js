import { test } from "node:test";
import assert from "node:assert/strict";
import { merge } from "../src/merge.js";

test("重なる区間をまとめる", () => {
  assert.deepEqual(
    merge([{ start: 1, end: 4 }, { start: 3, end: 6 }]),
    [{ start: 1, end: 6 }]
  );
});

test("入力が start の昇順でなくてもまとめる", () => {
  assert.deepEqual(
    merge([{ start: 5, end: 8 }, { start: 1, end: 3 }, { start: 2, end: 6 }]),
    [{ start: 1, end: 8 }]
  );
});

test("隣接する区間 [1,3) と [3,5) はひとつにまとめる", () => {
  assert.deepEqual(
    merge([{ start: 1, end: 3 }, { start: 3, end: 5 }]),
    [{ start: 1, end: 5 }]
  );
});

test("離れている区間はまとめない", () => {
  assert.deepEqual(
    merge([{ start: 1, end: 3 }, { start: 4, end: 5 }]),
    [{ start: 1, end: 3 }, { start: 4, end: 5 }]
  );
});
