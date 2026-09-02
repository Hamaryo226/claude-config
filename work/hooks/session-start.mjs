#!/usr/bin/env node
// SessionStart (startup | resume): リポジトリの現況を additionalContext として注入し、
// セッション冒頭の「git status を見て、ビルド方法を探す」往復を省く。
//
// 方針: 外部コマンドは全て失敗を握りつぶす。フックの失敗でセッション開始を妨げない。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// shell は使わない。Windows の cmd が引数中の空白を割ってしまい、
// `git log --pretty=format:%h %s` のような引数が壊れるため。
function sh(cmd, args, cwd, timeout = 3000) {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout,
    }).trim();
  } catch {
    return "";
  }
}

/** リポジトリの種類とビルド／テストの入口を推測する。 */
function detectStack(root) {
  const out = [];
  let names = [];
  try {
    names = readdirSync(root);
  } catch {
    return out;
  }

  const sln = names.find((n) => n.endsWith(".sln"));
  const csproj = names.find((n) => n.endsWith(".csproj"));
  if (sln || csproj) {
    const target = sln || csproj;
    out.push(`.NET: \`dotnet build ${target}\` / \`dotnet test\` / \`dotnet format\``);
  }

  if (existsSync(join(root, "package.json"))) {
    const pm = existsSync(join(root, "pnpm-lock.yaml"))
      ? "pnpm"
      : existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bun.lock"))
        ? "bun"
        : existsSync(join(root, "yarn.lock"))
          ? "yarn"
          : "npm";
    let scripts = [];
    try {
      const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
      scripts = Object.keys(pkg.scripts || {});
    } catch {
      /* package.json が壊れていても続行 */
    }
    const shown = scripts.slice(0, 10).join(", ") || "(scripts なし)";
    out.push(`Node: パッケージマネージャは ${pm}。scripts: ${shown}`);
  }

  if (existsSync(join(root, "pyproject.toml")) || existsSync(join(root, "requirements.txt"))) {
    out.push("Python: pyproject.toml / requirements.txt あり");
  }
  if (existsSync(join(root, "Cargo.toml"))) out.push("Rust: `cargo build` / `cargo test`");

  return out;
}

function main() {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    /* 入力が読めなくても cwd で続行 */
  }
  const cwd = input.cwd || process.cwd();

  const root = sh("git", ["rev-parse", "--show-toplevel"], cwd);
  if (!root) process.exit(0); // git リポジトリでなければ何もしない

  const lines = [];
  const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  const upstream = sh("git", ["rev-parse", "--abbrev-ref", "@{u}"], cwd);
  const ahead = upstream ? sh("git", ["rev-list", "--count", "@{u}..HEAD"], cwd) : "";
  const behind = upstream ? sh("git", ["rev-list", "--count", "HEAD..@{u}"], cwd) : "";

  let head = `- ブランチ: \`${branch}\``;
  if (/^(main|master)$/.test(branch)) head += " **(保護ブランチ。作業前にブランチを切ること)**";
  if (upstream) head += ` / 追跡: \`${upstream}\` (ahead ${ahead || 0}, behind ${behind || 0})`;
  else head += " / upstream なし";
  lines.push(head);

  const status = sh("git", ["status", "--porcelain"], cwd);
  const changed = status ? status.split("\n").filter(Boolean) : [];
  if (changed.length === 0) {
    lines.push("- 作業ツリー: クリーン");
  } else {
    lines.push(`- 未コミットの変更: ${changed.length} 件`);
    lines.push(...changed.slice(0, 15).map((l) => `  - \`${l}\``));
    if (changed.length > 15) lines.push(`  - ... 他 ${changed.length - 15} 件`);
  }

  const log = sh("git", ["log", "-3", "--pretty=format:%h %s"], cwd);
  if (log) {
    lines.push("- 直近のコミット:");
    lines.push(...log.split("\n").map((l) => `  - ${l}`));
  }

  const stack = detectStack(root);
  if (stack.length) {
    lines.push("- 検出したビルド／テストの入口:");
    lines.push(...stack.map((s) => `  - ${s}`));
  }

  // PR は無ければ静かに省略 (gh 未認証・リモート無し・PR 無しでも落ちない)
  const prJson = sh("gh", ["pr", "view", "--json", "number,title,state"], cwd, 5000);
  if (prJson.startsWith("{")) {
    try {
      const pr = JSON.parse(prJson);
      lines.push(`- このブランチの PR: #${pr.number} ${pr.title} [${pr.state}]`);
    } catch {
      /* 想定外の出力は無視 */
    }
  }

  const context = [
    "## セッション開始時のリポジトリ状況 (SessionStart フックによる自動収集)",
    "",
    ...lines,
    "",
    "この情報は自動収集されたスナップショットです。作業を始める前に改めて確認する必要はありませんが、",
    "時間が経った後は git status を取り直してください。",
  ].join("\n");

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
    })
  );
}

main();
