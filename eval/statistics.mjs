/** log(n choose k)。小標本の Fisher 正確確率検定でだけ使う。 */
function logChoose(n, k) {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || k > n) return -Infinity;
  const m = Math.min(k, n - k);
  let out = 0;
  for (let i = 1; i <= m; i++) out += Math.log(n - m + i) - Math.log(i);
  return out;
}

function hypergeometric(a, row1, row2, successes) {
  return Math.exp(logChoose(row1, a) + logChoose(row2, successes - a) - logChoose(row1 + row2, successes));
}

/**
 * 2 群の成功数に対する両側 Fisher 正確確率検定。
 * 「観測表以下の確率を持つ表を合計する」という R / scipy と同じ定義を使う。
 */
export function fisherExactTwoSided(success1, n1, success2, n2) {
  for (const x of [success1, n1, success2, n2]) {
    if (!Number.isInteger(x) || x < 0) throw new TypeError("成功数と標本数は 0 以上の整数で指定する");
  }
  if (success1 > n1 || success2 > n2 || n1 === 0 || n2 === 0) {
    throw new RangeError("成功数は標本数以下、標本数は 1 以上で指定する");
  }

  const successes = success1 + success2;
  const min = Math.max(0, successes - n2);
  const max = Math.min(n1, successes);
  const observed = hypergeometric(success1, n1, n2, successes);
  let p = 0;
  for (let a = min; a <= max; a++) {
    const probability = hypergeometric(a, n1, n2, successes);
    if (probability <= observed * (1 + 1e-12)) p += probability;
  }
  return p > 1 - 1e-12 ? 1 : Math.min(1, p);
}

/** Holm 法で多重比較を補正する。返却順は入力順と同じ。 */
export function holmAdjust(pValues) {
  if (!Array.isArray(pValues) || pValues.some((p) => typeof p !== "number" || p < 0 || p > 1)) {
    throw new TypeError("pValues は 0〜1 の数値配列で指定する");
  }
  const sorted = pValues.map((p, index) => ({ p, index })).sort((a, b) => a.p - b.p);
  const adjusted = Array(pValues.length);
  let previous = 0;
  for (let rank = 0; rank < sorted.length; rank++) {
    const value = Math.min(1, sorted[rank].p * (sorted.length - rank));
    previous = Math.max(previous, value);
    adjusted[sorted[rank].index] = previous;
  }
  return adjusted;
}
