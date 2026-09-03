import { test } from "node:test";
import assert from "node:assert/strict";
import { parseKv, normalize, isValid, collect } from "../src/index.js";
import { summarize } from "../src/report.js";

test("key=value を分解できる", () => {
  assert.deepEqual(parseKv("a=1"), { key: "a", value: "1" });
});
test("値に = が入っていても最初の = で切る", () => {
  assert.deepEqual(parseKv("url=http://x/?a=b"), { key: "url", value: "http://x/?a=b" });
});
test("= が無ければ null", () => { assert.equal(parseKv("nope"), null); });
test("空白を落として書き戻せる", () => { assert.equal(normalize("  a = 1  "), "a=1"); });
test("キーの形式を検査できる", () => {
  assert.equal(isValid("a_1=x"), true);
  assert.equal(isValid("1a=x"), false);
});
test("後勝ちでまとめられる", () => {
  assert.deepEqual(collect("a=1\nb=2\na=3"), { a: "3", b: "2" });
});
test("集計できる", () => {
  assert.deepEqual(summarize("a=1\nb=2\nnope"), { total: 3, valid: 2, keys: 2 });
});
