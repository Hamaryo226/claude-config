#!/usr/bin/env node
// interval-merge の採点。
// テストの緑だけでなく、テスト自体が書き換えられていないことと、
// テストに無い入力でも仕様どおりに動くことを別に確かめる。
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ws = resolve(process.argv[2]);
const notes = [];

const r = spawnSync(process.execPath, ["--test"], { cwd: ws, encoding: "utf8", timeout: 180_000 });
const out = `${r.stdout || ""}${r.stderr || ""}`;
const pass = Number(/^# pass (\d+)$/m.exec(out)?.[1] ?? -1);
const fail = Number(/^# fail (\d+)$/m.exec(out)?.[1] ?? -1);
const testOk = r.status === 0 && fail === 0 && pass >= 6;
if (!testOk) notes.push(`テスト: pass=${pass} fail=${fail} exit=${r.status}`);

const testsUntouched = ["test/merge.test.js", "test/schedule.test.js"].every((p) => {
  const f = join(ws, p);
  return existsSync(f) && readFileSync(f, "utf8").includes("assert");
}) &&
  readFileSync(join(ws, "test/merge.test.js"), "utf8").includes("隣接する区間 [1,3) と [3,5) はひとつにまとめる") &&
  readFileSync(join(ws, "test/schedule.test.js"), "utf8").includes("minLength ちょうどの空きは残す");
if (!testsUntouched) notes.push("テストファイルが書き換えられている");

// テストに無い入力での回帰確認。ここが本体。
let hidden = { merge: false, free: false, long: false };
try {
  const m = await import(pathToFileURL(join(ws, "src", "merge.js")).href);
  const s = await import(pathToFileURL(join(ws, "src", "schedule.js")).href);
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  hidden.merge =
    // 逆順 + 隣接 + 空区間の混在
    eq(m.merge([{ start: 6, end: 9 }, { start: 3, end: 3 }, { start: 1, end: 3 }, { start: 3, end: 6 }]),
       [{ start: 1, end: 9 }]) &&
    // 包含関係 (後の区間が前を完全に含まない)
    eq(m.merge([{ start: 1, end: 10 }, { start: 3, end: 4 }]), [{ start: 1, end: 10 }]) &&
    // 空入力
    eq(m.merge([]), []);

  hidden.free =
    // 予定なし -> 1 日まるごと空き
    eq(s.freeSlots(9, 18, []), [{ start: 9, end: 18 }]) &&
    // 予定が日をはみ出す -> 末尾の空きを作らない
    eq(s.freeSlots(9, 18, [{ start: 8, end: 20 }]), []) &&
    // 予定が日の途中まで
    eq(s.freeSlots(0, 5, [{ start: 0, end: 2 }]), [{ start: 2, end: 5 }]);

  hidden.long =
    eq(s.longEnough([{ start: 0, end: 2 }, { start: 3, end: 4 }], 2), [{ start: 0, end: 2 }]);
} catch (e) {
  notes.push(`実装を読み込めない: ${e.message}`);
}
for (const [k, v] of Object.entries(hidden)) if (!v) notes.push(`隠しチェック ${k} に失敗`);
const hiddenOk = Object.values(hidden).every(Boolean);

process.stdout.write(JSON.stringify({
  success: testOk && testsUntouched && hiddenOk,
  build: true,
  test: testOk,
  notes,
  visibleTestsPassed: pass,
  hiddenChecksPassed: Object.values(hidden).filter(Boolean).length,
  hiddenChecksTotal: Object.keys(hidden).length,
}));
