#!/usr/bin/env node
// ts-bugfix の採点。決定的なチェックだけを行い、JSON を 1 行で標準出力に出す。
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ws = resolve(process.argv[2]);
const notes = [];

const r = spawnSync(process.execPath, ["--test"], { cwd: ws, encoding: "utf8", timeout: 120_000 });
const out = `${r.stdout || ""}${r.stderr || ""}`;
const pass = Number(/^# pass (\d+)$/m.exec(out)?.[1] ?? -1);
const fail = Number(/^# fail (\d+)$/m.exec(out)?.[1] ?? -1);
const testOk = r.status === 0 && fail === 0 && pass >= 3;
if (!testOk) notes.push(`テスト: pass=${pass} fail=${fail} exit=${r.status}`);

// テスト側を書き換えて緑にするのは不正解。fixture と同一であることを確かめる。
const testPath = join(ws, "test", "chunk.test.js");
const testUntouched = existsSync(testPath) &&
  readFileSync(testPath, "utf8").includes("割り切れない件数でも端数を落とさない") &&
  readFileSync(testPath, "utf8").includes("[[1, 2], [3, 4], [5]]");
if (!testUntouched) notes.push("テストファイルが書き換えられている (期待する解き方ではない)");

// 実装が実際に端数を返すか、テストとは独立に確かめる
let behaviourOk = false;
try {
  const { chunk } = await import(pathToFileURL(join(ws, "src", "chunk.js")).href);
  behaviourOk = JSON.stringify(chunk([1, 2, 3, 4, 5], 2)) === JSON.stringify([[1, 2], [3, 4], [5]]);
} catch (e) {
  notes.push(`src/chunk.js を読み込めない: ${e.message}`);
}
if (!behaviourOk) notes.push("chunk([1,2,3,4,5], 2) が期待値を返さない");

process.stdout.write(JSON.stringify({
  success: testOk && testUntouched && behaviourOk,
  build: true,
  buildNote: "ビルド工程の無いプロジェクト。build は常に true として扱う",
  test: testOk,
  notes,
}));
