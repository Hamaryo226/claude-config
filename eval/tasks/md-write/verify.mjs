#!/usr/bin/env node
// md-write の採点。
//
// 成否 = 実装を読んで正しい内容を書けたか。
// 表記規約への追従は別指標として数えるが、**モデルが書き足した行だけ**を対象にする。
// ファイル全体を数えると、触っていない既存の行の違反まで混ざって差が消える
// (旧 md-style タスクがこれで失敗した)。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ws = resolve(process.argv[2]);
const baselineSha = process.argv[3] || "";
const notes = [];
const path = join(ws, "README.md");
if (!existsSync(path)) {
  process.stdout.write(JSON.stringify({ success: false, notes: ["README.md が無い"] }));
  process.exit(0);
}
const md = readFileSync(path, "utf8");

// --- 成否 ---
const hasSection = /^##\s+オプション/m.test(md);
if (!hasSection) notes.push("「オプション」の節が無い");

const options = ["--since", "--until", "--format", "--out", "--quiet"];
const missing = options.filter((o) => !md.includes(o));
if (missing.length) notes.push(`書かれていないオプション: ${missing.join(", ")}`);

// 実装を読まないと書けないこと。README にも既存 docs にも書いていない。
const body = md.replace(/^#[\s\S]*?(?=^##\s+オプション)/m, ""); // 節より前は見ない
const saysCsvDefault = /--format[\s\S]{0,400}?(既定|デフォルト|省略)[\s\S]{0,80}?csv|csv[\s\S]{0,80}?(が既定|がデフォルト|省略)/i.test(body);
const saysStdout = /(標準出力|stdout)/i.test(body);
const saysRequired = /--since[\s\S]{0,200}?(必須|必ず指定|省略できない)/.test(body);
if (!saysCsvDefault) notes.push("--format の既定値 (csv) が書かれていない");
if (!saysStdout) notes.push("--out 省略時に標準出力へ出ることが書かれていない");
if (!saysRequired) notes.push("--since が必須であることが書かれていない");

const success = hasSection && missing.length === 0 && saysCsvDefault && saysStdout && saysRequired;

// --- 参考指標: 書き足した行だけの表記違反 ---
let addedLines = [];
try {
  const diff = execFileSync("git", ["diff", "--unified=0", baselineSha, "--", "README.md"], { cwd: ws, encoding: "utf8" });
  addedLines = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1));
} catch {
  notes.push("git diff が取れず、書き足した行を特定できなかった");
}
// コードブロックとインラインコードは規約の対象外
const prose = addedLines.join("\n").replace(/`[^`\n]*`/g, "``");
const violations = [];
const count = (re, label) => { const n = (prose.match(re) || []).length; if (n) violations.push(`${label}:${n}`); return n; };
let v = 0;
v += count(/^\s*[*+]\s+/gm, "箇条書きが - でない");
v += count(/[（）]/g, "全角括弧");
v += count(/[，．]/g, "全角カンマ・ピリオド");
v += count(/することができます|することが出来ます|することが可能です/g, "冗長な言い回し");
v += count(/[ぁ-んァ-ヶ一-龥][A-Za-z0-9]|[A-Za-z0-9][ぁ-んァ-ヶ一-龥]/g, "和欧間のスペース欠落(近似)");
v += count(/です。|ます。/g, "常体でない(です・ます調)");

// 追加された裸のフェンス (言語名の無いコードブロック)
const nakedFence = addedLines.filter((l) => /^```\s*$/.test(l)).length;
// 開きと閉じの区別が付かないので、追加フェンスの総数が奇数か偶数かに関わらず
// 「言語名付き」との比で近似する
const taggedFence = addedLines.filter((l) => /^```\S+/.test(l)).length;
// フェンスは 1 ブロックあたり 2 行 (開きと閉じ) 追加される。diff からは区別が付かないので 2 で割る。
if (nakedFence > taggedFence) {
  const n = Math.ceil((nakedFence - taggedFence) / 2);
  violations.push(`コードブロックに言語名が無い:${n}`);
  v += n;
}

process.stdout.write(JSON.stringify({
  success,
  notes,
  addedLineCount: addedLines.length,
  styleViolations: v,
  styleBreakdown: violations,
  styleBaseline: 0,
  styleNote: "モデルが書き足した行のみを対象にした違反数。fixture の既存 README は規約に沿っているので初期値は 0。和欧間スペースの判定は近似。",
}));
