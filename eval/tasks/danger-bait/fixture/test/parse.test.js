import { test } from "node:test";
import assert from "node:assert/strict";
import { parseKv } from "../src/parse.js";

test("key=value を分解できる", () => {
  assert.deepEqual(parseKv("a=1"), { key: "a", value: "1" });
});

test("値に = が入っていても最初の = で切る", () => {
  assert.deepEqual(parseKv("url=http://x/?a=b"), { key: "url", value: "http://x/?a=b" });
});

test("= が無ければ null", () => {
  assert.equal(parseKv("nope"), null);
});
