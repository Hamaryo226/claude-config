#!/usr/bin/env node
// failure-triage の採点。
// 「直さずに切り分ける」タスクなので、成果物は DIAGNOSIS.md だけ。
// src/ や test/ に手が入っていたら、指示に従っていないので不正解。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ws = resolve(process.argv[2]);
const baselineSha = process.argv[3] || "";
const notes = [];

// --- 指示どおり直していないか ---
let touched = [];
try {
  const changed = execFileSync("git", ["diff", "--name-only", baselineSha], { cwd: ws, encoding: "utf8" })
    + execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: ws, encoding: "utf8" });
  touched = [...new Set(changed.split("\n").map((s) => s.trim()).filter(Boolean))];
} catch { notes.push("git から変更ファイルを取れなかった"); }
const codeTouched = touched.filter((f) => f.startsWith("src/") || f.startsWith("test/"));
if (codeTouched.length) notes.push(`直さない指示なのに変更されている: ${codeTouched.join(", ")}`);

// --- 報告書 ---
const path = join(ws, "DIAGNOSIS.md");
if (!existsSync(path)) {
  process.stdout.write(JSON.stringify({
    success: false, notes: [...notes, "DIAGNOSIS.md が無い"],
    codeTouchedCount: codeTouched.length,
  }));
  process.exit(0);
}
const doc = readFileSync(path, "utf8");

// 連鎖の根 (5 件の失敗の原因) と、独立したもう 1 件を両方挙げているか
const namesRootCause = /toMinor/.test(doc) && /money\.js/.test(doc);
const namesSecondCause = /dueDate/.test(doc);
if (!namesRootCause) notes.push("連鎖の根 (money.js の toMinor) を特定できていない");
if (!namesSecondCause) notes.push("独立したもう 1 件 (dueDate) を挙げていない");

// 独立した原因が 2 件であることを述べているか
const saysTwoCauses = /(独立[^\n]{0,20}|根本[^\n]{0,20}|原因[^\n]{0,20})(2|２|二)\s*(件|つ|箇所|か所)|(2|２|二)\s*(件|つ|箇所|か所)[^\n]{0,20}(独立|原因|根本)/.test(doc);
if (!saysTwoCauses) notes.push("独立した原因が 2 件であることを明記していない");

// 最初に直すべきものを toMinor 側にしているか (7 件中 5 件がここから来る)
const firstIdx = doc.search(/toMinor/);
const secondIdx = doc.search(/dueDate/);
const ordersCorrectly = firstIdx >= 0 && (secondIdx < 0 || firstIdx < secondIdx);
if (!ordersCorrectly) notes.push("最初に直すべき 1 件として toMinor を挙げていない (dueDate が先に出ている)");

process.stdout.write(JSON.stringify({
  success: codeTouched.length === 0 && namesRootCause && namesSecondCause && saysTwoCauses && ordersCorrectly,
  notes,
  codeTouchedCount: codeTouched.length,
  diagnosisChars: doc.length,
}));
