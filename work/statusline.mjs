#!/usr/bin/env node
// Claude Code ステータスライン (2 行)。
// stdin で受け取るセッション JSON の仕様: https://code.claude.com/docs/en/statusline
// jq を使わないので Windows でもそのまま動く。
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BS = String.fromCharCode(92); // Windows のパス区切り

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function git(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();
  } catch {
    return "";
  }
}

/** ホームディレクトリを ~ に、深いパスを末尾 2 階層に縮める。 */
function shortenDir(dir) {
  if (!dir) return "";
  const p = dir.split(BS).join("/");
  const home = (process.env.USERPROFILE || process.env.HOME || "").split(BS).join("/");
  const rel =
    home && p.toLowerCase().startsWith(home.toLowerCase()) ? "~" + p.slice(home.length) : p;
  const parts = rel.split("/").filter(Boolean);
  return parts.length <= 2 ? rel : ".../" + parts.slice(-2).join("/");
}

function bar(pct, width = 10) {
  const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
  return "#".repeat(filled) + ".".repeat(width - filled);
}

function main() {
  const raw = readStdin();
  let d = {};
  try {
    d = JSON.parse(raw);
  } catch {
    // 壊れた入力でもステータスラインを消さない
  }

  const cwd = d.workspace?.current_dir || d.cwd || process.cwd();
  const model = d.model?.display_name || "Claude";
  const effort = d.effort?.level;
  const pct = Math.round(Number(d.context_window?.used_percentage ?? 0));
  const cost = Number(d.cost?.total_cost_usd ?? 0);
  const added = Number(d.cost?.total_lines_added ?? 0);
  const removed = Number(d.cost?.total_lines_removed ?? 0);

  // --- 1 行目: モデル / ディレクトリ / git ---
  const line1 = [`${C.magenta}${C.bold}${model}${C.reset}`];
  if (d.fast_mode) line1.push(`${C.yellow}fast${C.reset}`);
  line1.push(`${C.blue}${shortenDir(cwd)}${C.reset}`);

  const branch = d.worktree?.branch || git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  if (branch && branch !== "HEAD") {
    const dirty = git(["status", "--porcelain"], cwd);
    const n = dirty ? dirty.split("\n").filter(Boolean).length : 0;
    const mark = n ? `${C.yellow}*${n}${C.reset}` : `${C.green}clean${C.reset}`;
    // main / master に居るときは赤で警告する
    const bcolor = /^(main|master)$/.test(branch) ? C.red : C.cyan;
    line1.push(`${bcolor}${branch}${C.reset} ${mark}`);
  }
  if (d.worktree?.name) line1.push(`${C.dim}wt:${d.worktree.name}${C.reset}`);
  if (d.pr?.number) line1.push(`${C.dim}PR#${d.pr.number}${C.reset}`);
  if (d.agent?.name) line1.push(`${C.dim}@${d.agent.name}${C.reset}`);

  // --- 2 行目: コンテキスト / コスト / effort ---
  const ctxColor = pct >= 80 ? C.red : pct >= 50 ? C.yellow : C.green;
  const line2 = [
    `${ctxColor}[${bar(pct)}]${C.reset} ${ctxColor}${pct}%${C.reset}${C.dim} ctx${C.reset}`,
  ];
  if (cost > 0) line2.push(`${C.dim}$${cost.toFixed(3)}${C.reset}`);
  if (added || removed) {
    line2.push(`${C.green}+${added}${C.reset}${C.dim}/${C.reset}${C.red}-${removed}${C.reset}`);
  }
  if (effort) line2.push(`${C.dim}effort:${effort}${C.reset}`);
  const five = d.rate_limits?.five_hour?.used_percentage;
  if (typeof five === "number" && five >= 60) {
    line2.push(`${five >= 85 ? C.red : C.yellow}5h:${Math.round(five)}%${C.reset}`);
  }

  const sep = ` ${C.dim}|${C.reset} `;
  process.stdout.write(line1.join(sep) + "\n" + line2.join(sep));
}

main();
