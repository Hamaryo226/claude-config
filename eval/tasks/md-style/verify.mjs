#!/usr/bin/env node
// md-style の採点。
// 「実装との食い違いが直ったか」を成否とし、日本語の表記規約への追従は別指標として数える。
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ws = resolve(process.argv[2]);
const notes = [];
const path = join(ws, "README.md");
if (!existsSync(path)) {
  process.stdout.write(JSON.stringify({ success: false, notes: ["README.md が無い"] }));
  process.exit(0);
}
const md = readFileSync(path, "utf8");
const scripts = JSON.parse(readFileSync(join(ws, "package.json"), "utf8")).scripts;

// --- 成否: 実在しないスクリプト名が消え、実在するものに置き換わっているか ---
const stale = ["npm run compile", "npm run dump", "npm run test"].filter((c) => md.includes(c));
const fresh = ["npm run build", "npm run check", "npm run export"].filter((c) => md.includes(c));
if (stale.length) notes.push(`実装に無いコマンドが残っている: ${stale.join(", ")}`);
if (fresh.length < 3) notes.push(`実装にあるコマンドのうち ${3 - fresh.length} 件が README に無い`);
const success = stale.length === 0 && fresh.length === 3;

// --- 参考指標: markdown-ja.md の規約に対する違反数 (fixture 初期値は 10) ---
// コードブロックの中は対象外にする。
const body = md.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "``");
const violations = [];
const count = (re, label) => { const n = (body.match(re) || []).length; if (n) violations.push(`${label}:${n}`); return n; };
let v = 0;
v += count(/^\s*[*+]\s+/gm, "箇条書きが - でない");
v += count(/[（）]/g, "全角括弧");
v += count(/[，．]/g, "全角カンマ・ピリオド");
v += count(/することができます|することが出来ます/g, "冗長な言い回し");
v += count(/[ぁ-んァ-ヶ一-龥][A-Za-z0-9]|[A-Za-z0-9][ぁ-んァ-ヶ一-龥]/g, "和欧間のスペース欠落(近似)");
// フェンスは本文から除去済みなので、元の md から数える
const nakedFence = (md.match(/^```\s*$\n(?![\s\S]*?^```)/gm) || []).length;
const fences = [...md.matchAll(/^```(\S*)\s*$/gm)].map((m) => m[1]);
const nakedOpen = fences.filter((f, i) => i % 2 === 0 && f === "").length;
if (nakedOpen) violations.push(`コードブロックに言語名が無い:${nakedOpen}`);
v += nakedOpen;

process.stdout.write(JSON.stringify({
  success,
  notes,
  styleViolations: v,
  styleBreakdown: violations,
  styleBaseline: 15,
  styleNote: "参考指標。fixture 初期状態での違反数を styleBaseline に置いてある。和欧間スペースの判定は近似。",
}));
