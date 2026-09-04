import test from "node:test";
import assert from "node:assert/strict";
import { fisherExactTwoSided, holmAdjust } from "../statistics.mjs";

test("Fisher 正確確率検定が既知の両側 p 値を返す", () => {
  const p = fisherExactTwoSided(1, 10, 11, 14);
  assert.ok(Math.abs(p - 0.0027594561852200836) < 1e-12, `p=${p}`);
});

test("両群が同じなら p=1", () => {
  assert.equal(fisherExactTwoSided(3, 6, 3, 6), 1);
});

test("Holm 補正は入力順を保ち、単調性を満たす", () => {
  assert.deepEqual(holmAdjust([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test("不正な分割表を拒否する", () => {
  assert.throws(() => fisherExactTwoSided(2, 1, 0, 1), RangeError);
  assert.throws(() => fisherExactTwoSided(0, 0, 0, 1), RangeError);
});
