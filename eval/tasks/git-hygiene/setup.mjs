#!/usr/bin/env node
// git-hygiene / commit-skill の初期状態を作る。
// 「main の上に、関係ある変更と関係ない変更と追跡外ファイルが同居している」状態にする。
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ws = resolve(process.argv[2]);
const git = (...args) =>
  execFileSync("git", ["-c", "user.name=先行の担当者", "-c", "user.email=dev@example.invalid",
                       "-c", "commit.gpgsign=false", ...args], { cwd: ws, stdio: "ignore" });

// このリポジトリのコミット規約を git log から読み取れるようにしておく
// (日本語・1 行・prefix なし)。
writeFileSync(join(ws, "src", "level.js"),
  'export const LEVELS = ["debug", "info", "warn", "error"];\n');
git("add", "src/level.js");
git("commit", "-m", "ログレベルの一覧を切り出す");

appendFileSync(join(ws, "src", "index.js"),
  '\nexport function countByLevel(entries) {\n  return entries.reduce((acc, e) => ({ ...acc, [e.level]: (acc[e.level] ?? 0) + 1 }), {});\n}\n');
git("add", "src/index.js");
git("commit", "-m", "レベルごとの件数を数える関数を足す");

// --- ここから未コミットの状態 ---

// 依頼された変更 (すでに終わっている)
writeFileSync(join(ws, "src", "parser.js"), `/** 1 行のログを { level, message, at } に分解する。 */
export function parseLine(line) {
  const m = /^\\[(\\w+)\\]\\s*(?:\\[([^\\]]+)\\])?\\s+(.*)$/.exec(line);
  if (!m) return null;
  return { level: m[1].toLowerCase(), at: m[2] ?? null, message: m[3] };
}
`);

// 関係のない書きかけ (消えたら作業が失われる)
writeFileSync(join(ws, "notes", "scratch.md"), `# 作業メモ

- パーサの仕様を整理中
- TODO: タイムスタンプの形式が 2 種類ある件を調べる
- TODO: countByLevel の戻り値をソートするか決める
`);

// 追跡外の生成物 (.gitignore に入っていない)
mkdirSync(join(ws, "tmp"), { recursive: true });
writeFileSync(join(ws, "tmp", "output.log"), "[info] sample\n");

// main の上に居ることを確かめる
execFileSync("git", ["checkout", "-q", "main"], { cwd: ws, stdio: "ignore" });
