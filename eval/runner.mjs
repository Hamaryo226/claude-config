#!/usr/bin/env node
// claude-config 評価ハーネス — 実行本体。
//
// 1 回の run で (タスク × アーム × 反復) の直積を回し、生の実行記録だけを書き出す。
// 集計と採点は analyze.mjs が別プロセスで行う (再集計のたびに再実行しなくて済むように)。
//
// 使い方は eval/README.md を見ること。
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, chmodSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir, hostname, platform, arch, release } from "node:os";
import { createHash, randomUUID } from "node:crypto";

const EVAL_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = resolve(EVAL_DIR, "..");

// ---------------------------------------------------------------- 引数

const DEFAULTS = {
  profile: "personal",
  arms: null,
  tasks: null,
  repeat: 1,
  model: "sonnet",
  effort: "medium",
  permissionMode: "bypassPermissions",
  allowedTools: null,
  timeout: 900,
  out: null,
  copyCredentials: false,
  dryRun: false,
  keepWorkspace: true,
};

function parseArgs(argv) {
  const o = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--profile": o.profile = next(); break;
      case "--arms": o.arms = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--tasks": o.tasks = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--repeat": o.repeat = Number(next()); break;
      case "--model": o.model = next(); break;
      case "--effort": o.effort = next(); break;
      case "--permission-mode": o.permissionMode = next(); break;
      case "--allowed-tools": o.allowedTools = next(); break;
      case "--timeout": o.timeout = Number(next()); break;
      case "--out": o.out = next(); break;
      case "--copy-credentials": o.copyCredentials = true; break;
      case "--dry-run": o.dryRun = true; break;
      case "--no-keep-workspace": o.keepWorkspace = false; break;
      case "-h": case "--help": usage(); process.exit(0);
      default: die(`不明な引数: ${a}`);
    }
  }
  if (!["personal", "work"].includes(o.profile)) die(`--profile は personal か work`);
  if (!Number.isInteger(o.repeat) || o.repeat < 1) die("--repeat は 1 以上の整数");
  return o;
}

function usage() {
  console.log(`
使い方: node eval/runner.mjs [options]

  --profile <personal|work>   評価する設定プロファイル (既定: personal)
  --arms <id,id,...>          回すアーム (既定: arms.json の全部)
  --tasks <id,id,...>         回すタスク (既定: eval/tasks/ の全部)
  --repeat <N>                同一条件の反復回数 (既定: 1)
  --model <name>              --model に渡す値 (既定: sonnet)
  --effort <level>            --effort に渡す値 (既定: medium)
  --permission-mode <mode>    (既定: bypassPermissions。README の「権限まわりの制約」を読むこと)
  --allowed-tools <list>      全アームに同じ --allowedTools を渡す (空白区切り)。
                              dontAsk と組み合わせると「全アーム共通の下限 + 各アームの deny」で回せる
  --timeout <sec>             1 実行あたりの上限秒数 (既定: 900)
  --out <dir>                 出力先 (既定: <tmp>/claude-config-eval/<run-id>)
  --copy-credentials          .credentials.json を各アームの設定ディレクトリへ複製する
  --dry-run                   実行計画と実験条件だけを書き出して終わる
  --no-keep-workspace         実行後に作業コピーを消す (差分は取得済み)
`);
}

const die = (m) => { console.error(`エラー: ${m}`); process.exit(1); };
const log = (m) => console.log(m);

// ---------------------------------------------------------------- 小道具

function sh(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
  } catch (e) {
    if (opts.throwOnError) throw e;
    return "";
  }
}

const git = (cwd, args) =>
  sh("git", ["-c", "user.name=claude-config-eval", "-c", "user.email=eval@example.invalid",
             "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false", ...args], { cwd, throwOnError: true });

function sha256OfDir(dir) {
  const h = createHash("sha256");
  const walk = (d, rel) => {
    for (const name of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(d, name.name);
      const r = rel ? `${rel}/${name.name}` : name.name;
      if (name.isDirectory()) walk(p, r);
      else { h.update(r); h.update(readFileSync(p)); }
    }
  };
  walk(dir, "");
  return h.digest("hex").slice(0, 16);
}

// 親セッションの状態が子プロセスへ漏れると条件が揃わないので、CLAUDE_* は原則落とす。
// 認証系 (ANTHROPIC_*) と一般の環境変数は残す。
const ENV_KEEP_PREFIX = ["ANTHROPIC_"];
function childEnv(extra) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("CLAUDE") && !ENV_KEEP_PREFIX.some((p) => k.startsWith(p))) continue;
    env[k] = v;
  }
  return { ...env, ...extra };
}

// ---------------------------------------------------------------- アームの設定ディレクトリを組み立てる

function buildArmConfig(arm, armsSpec, profileDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  const included = [];
  for (const layer of arm.layers) {
    for (const item of armsSpec.layers[layer] || []) {
      const src = join(profileDir, item);
      if (!existsSync(src)) { console.warn(`  警告: ${arm.id}: ${item} がプロファイルに無い`); continue; }
      cpSync(src, join(destDir, item), { recursive: true });
      included.push(item);
    }
  }

  // work プロファイルの CLAUDE.md は「要記入」の空欄を持つ。空欄のままだと
  // アームの内容が実行ごとに曖昧になるので、決め打ちの環境記述で埋める。
  const claudeMd = join(destDir, "CLAUDE.md");
  const envFile = join(EVAL_DIR, "profiles", "work-env.md");
  if (existsSync(claudeMd) && existsSync(envFile)) {
    const body = readFileSync(claudeMd, "utf8");
    if (body.includes("## この環境について (要記入)")) {
      const filled = body.replace(
        /## この環境について \(要記入\)[\s\S]*?(?=\n## )/,
        readFileSync(envFile, "utf8").trimEnd() + "\n\n"
      );
      writeFileSync(claudeMd, filled);
    }
  }

  // settings.json はそのままでは使えない。絶対パスのプレースホルダを実パスに置換し、
  // ヘッドレスで意味を持たないキーを落とす。
  const settingsPath = join(destDir, "settings.json");
  if (existsSync(settingsPath)) {
    let raw = readFileSync(settingsPath, "utf8");
    for (const ph of armsSpec.settings.pathPlaceholders) raw = raw.split(ph).join(destDir.split("\\").join("/"));
    const obj = JSON.parse(raw);
    for (const key of armsSpec.settings.strip) delete obj[key];
    writeFileSync(settingsPath, JSON.stringify(obj, null, 2) + "\n");
  }
  return included;
}

function copyCredentials(destDir) {
  const realCfg = process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME || process.env.USERPROFILE || "", ".claude");
  const src = join(realCfg, ".credentials.json");
  if (!existsSync(src)) return false;
  const dst = join(destDir, ".credentials.json");
  cpSync(src, dst);
  try { chmodSync(dst, 0o600); } catch { /* Windows では効かないことがある */ }
  return true;
}

// ---------------------------------------------------------------- 作業コピーの用意

function materializeWorkspace(task, wsDir) {
  mkdirSync(wsDir, { recursive: true });
  cpSync(join(task.assetDir, "fixture"), wsDir, { recursive: true });

  git(wsDir, ["init", "-q"]);
  // 既定ブランチ名が環境によって変わると git-hygiene 系タスクの前提が崩れる。main に固定する。
  git(wsDir, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  git(wsDir, ["add", "-A"]);
  git(wsDir, ["commit", "-q", "-m", "fixture"]);

  const setup = join(task.assetDir, "setup.mjs");
  if (existsSync(setup)) {
    const r = spawnSync(process.execPath, [setup, wsDir], { encoding: "utf8" });
    if (r.status !== 0) die(`${task.id}: setup.mjs が失敗\n${r.stdout}\n${r.stderr}`);
  }

  // 基準は「setup を終えた直後の状態」。ここを fixture のコミットにすると、
  // setup.mjs が作った未コミットの変更まで「モデルが変更したファイル」に数えてしまう。
  return { baselineSha: git(wsDir, ["rev-parse", "HEAD"]), baseline: snapshot(wsDir) };
}

/** 作業ツリーの内容を path -> hash で記録する。.git は除く。 */
function snapshot(dir) {
  const out = {};
  const walk = (d, rel) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".git") continue;
      const p = join(d, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p, r);
      else if (e.isFile()) out[r] = createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);
    }
  };
  walk(dir, "");
  return out;
}

/** 作業コピーの変更を、setup 直後のスナップショットとの差として拾う。 */
function collectDiff(wsDir, baselineSha, baseline) {
  const after = snapshot(wsDir);
  const added = Object.keys(after).filter((f) => !(f in baseline));
  const deleted = Object.keys(baseline).filter((f) => !(f in after));
  const modified = Object.keys(after).filter((f) => f in baseline && baseline[f] !== after[f]);

  return {
    changedFiles: [...added, ...modified, ...deleted].sort(),
    addedFiles: added.sort(),
    modifiedFiles: modified.sort(),
    deletedFiles: deleted.sort(),
    worktreeStatus: git(wsDir, ["status", "--porcelain"]),
    branch: git(wsDir, ["rev-parse", "--abbrev-ref", "HEAD"]),
    commits: git(wsDir, ["log", "--pretty=format:%H%x09%an%x09%s", `${baselineSha}..HEAD`])
      .split("\n").filter(Boolean).map((l) => {
        const [sha, author, ...rest] = l.split("\t");
        return { sha, author, subject: rest.join("\t") };
      }),
    patch: git(wsDir, ["diff", baselineSha]),
  };
}

// ---------------------------------------------------------------- 1 実行

function runOne({ task, arm, rep, opts, configDir, runDir }) {
  const key = `${task.id}__${arm.id}__r${rep}`;
  const caseDir = join(runDir, "cases", key);
  mkdirSync(caseDir, { recursive: true });
  const wsDir = join(caseDir, "workspace");

  const { baselineSha, baseline } = materializeWorkspace(task, wsDir);
  const prompt = readFileSync(join(task.dir, "prompt.md"), "utf8").trim();
  const sessionId = randomUUID();

  const args = [
    "-p", prompt,
    "--model", opts.model,
    "--effort", opts.effort,
    "--output-format", "stream-json",
    "--verbose",
    "--include-hook-events",
    "--permission-mode", opts.permissionMode,
    "--session-id", sessionId,
    // アームの設定は CLAUDE_CONFIG_DIR (= user スコープ) にだけ置く。
    // 作業コピー側の .claude/ を読ませると条件が汚れるので project / local は外す。
    "--setting-sources", "user",
    "--no-session-persistence",
  ];
  // 全アームに同じ下限を与えるための逃げ道。アームごとに変えてはいけない。
  if (opts.allowedTools) args.push("--allowedTools", ...opts.allowedTools.split(/\s+/).filter(Boolean));

  log(`  実行: ${key}`);
  const started = Date.now();
  const r = spawnSync("claude", args, {
    cwd: wsDir,
    env: childEnv({ CLAUDE_CONFIG_DIR: configDir }),
    encoding: "utf8",
    input: "",
    timeout: opts.timeout * 1000,
    maxBuffer: 256 * 1024 * 1024,
  });
  const wallMs = Date.now() - started;

  writeFileSync(join(caseDir, "stream.jsonl"), r.stdout || "");
  writeFileSync(join(caseDir, "stderr.txt"), r.stderr || "");

  const diff = collectDiff(wsDir, baselineSha, baseline);
  writeFileSync(join(caseDir, "workspace.diff"), diff.patch);
  delete diff.patch;

  // 採点はタスク自身の verify.mjs が行う。判定を決定的に保つため、モデルには一切通さない。
  let verify = { ran: false, note: "verify.mjs が無い" };
  const verifyPath = join(task.assetDir, "verify.mjs");
  if (existsSync(verifyPath)) {
    const v = spawnSync(process.execPath, [verifyPath, wsDir, baselineSha], { encoding: "utf8", timeout: 300_000 });
    try {
      verify = { ran: true, ...JSON.parse(v.stdout) };
    } catch {
      verify = { ran: true, error: "verify.mjs の出力が JSON として読めない", stdout: (v.stdout || "").slice(0, 2000), stderr: (v.stderr || "").slice(0, 2000) };
    }
  }

  const meta = {
    key, task: task.id, arm: arm.id, rep, sessionId, baselineSha,
    spawn: { status: r.status, signal: r.signal, timedOut: r.error?.code === "ETIMEDOUT" || r.signal === "SIGTERM", error: r.error ? String(r.error.message) : null },
    wallMs,
    workspace: diff,
    verify,
    expectedFiles: task.spec.expectedFiles || [],
  };
  writeFileSync(join(caseDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");

  if (!opts.keepWorkspace) rmSync(wsDir, { recursive: true, force: true });
  return meta;
}

// ---------------------------------------------------------------- main

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const armsSpec = JSON.parse(readFileSync(join(EVAL_DIR, "arms.json"), "utf8"));

  const profileDir = opts.profile === "work" ? join(REPO_DIR, "work") : REPO_DIR;
  if (!existsSync(join(profileDir, "CLAUDE.md"))) die(`プロファイルが見つからない: ${profileDir}`);

  const arms = armsSpec.arms.filter((a) => !opts.arms || opts.arms.includes(a.id));
  if (opts.arms) for (const id of opts.arms) if (!arms.some((a) => a.id === id)) die(`不明なアーム: ${id}`);

  const taskRoot = join(EVAL_DIR, "tasks");
  const taskIds = readdirSync(taskRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(taskRoot, d.name, "task.json")))
    .map((d) => d.name)
    .filter((id) => !opts.tasks || opts.tasks.includes(id))
    .sort();
  if (opts.tasks) for (const id of opts.tasks) if (!taskIds.includes(id)) die(`不明なタスク: ${id}`);
  if (taskIds.length === 0) die("実行するタスクが無い");

  const tasks = taskIds.map((id) => {
    const dir = join(taskRoot, id);
    const spec = JSON.parse(readFileSync(join(dir, "task.json"), "utf8"));
    // fixture / setup.mjs / verify.mjs を別タスクと共有できるようにする。
    // 同じ初期状態に対して指示だけを変える比較 (例: 自然文 vs /commit) を、
    // fixture を二重管理せずに書けるようにするため。
    const assetDir = spec.assetsFrom ? join(taskRoot, spec.assetsFrom) : dir;
    if (!existsSync(join(assetDir, "fixture"))) die(`${id}: fixture が無い (${assetDir})`);
    return { id, dir, assetDir, spec, fixtureHash: sha256OfDir(join(assetDir, "fixture")) };
  });

  const runId = new Date().toISOString().replace(/[:.]/g, "-").replace("Z", "Z") + "_" + opts.profile;
  const runDir = opts.out ? resolve(opts.out) : join(tmpdir(), "claude-config-eval", runId);
  mkdirSync(runDir, { recursive: true });

  // ---- 実験条件を残す。ここが無いと後から結果を読み直せない ----
  const configSha = sh("git", ["rev-parse", "HEAD"], { cwd: REPO_DIR });
  const configDirty = sh("git", ["status", "--porcelain"], { cwd: REPO_DIR }) !== "";
  const claudeVersion = sh("claude", ["--version"]);
  const conditions = {
    runId,
    startedAt: new Date().toISOString(),
    profile: opts.profile,
    profileDir: profileDir.split("\\").join("/"),
    configCommitSha: configSha || "(不明: git 情報を取得できない)",
    configWorkingTreeDirty: configDirty,
    configDirtyWarning: configDirty ? "作業ツリーに未コミットの変更がある。この結果は configCommitSha だけでは再現できない。" : null,
    claudeCodeVersion: claudeVersion || "(不明)",
    claudeCodeBinary: sh(process.platform === "win32" ? "where" : "which", ["claude"]).split("\n")[0] || "(不明)",
    model: opts.model,
    effort: opts.effort,
    permissionMode: opts.permissionMode,
    allowedTools: opts.allowedTools,
    settingSources: "user",
    timeoutSec: opts.timeout,
    repeat: opts.repeat,
    node: process.version,
    os: { platform: platform(), release: release(), arch: arch(), host: hostname() },
    gitVersion: sh("git", ["--version"]),
    arms: arms.map((a) => ({ id: a.id, label: a.label, layers: a.layers })),
    tasks: tasks.map((t) => ({ id: t.id, fixtureHash: t.fixtureHash, exercises: t.spec.exercises || [], expectedFiles: t.spec.expectedFiles || [] })),
    strippedSettingsKeys: armsSpec.settings.strip,
    envStripped: "CLAUDE* (ANTHROPIC_* を除く) を子プロセスから落としている",
    caveats: [
      opts.permissionMode === "bypassPermissions"
        ? "permissionMode=bypassPermissions のため、settings.json の permissions.allow / ask / deny の効果はこの run では測っていない (すべて迂回される)。"
        : `permissionMode=${opts.permissionMode}。permissions.allow に無いツールは自動的に拒否される。`
          + (opts.allowedTools ? ` --allowed-tools で全アームに共通の下限 (${opts.allowedTools}) を与えている。` : " アーム間でツールの使える範囲が揃っていないため、成功率の比較には使えない。"),
      "モデルの出力は非決定的。反復 1 回の差はノイズと区別できない。",
      "「人間による修正が必要だった回数」は自動取得できない。analyze.mjs が出す human-review.csv に手で記入すること。",
    ],
  };
  writeFileSync(join(runDir, "run.json"), JSON.stringify(conditions, null, 2) + "\n");

  log(`run-id: ${runId}`);
  log(`出力先: ${runDir}`);
  log(`プロファイル: ${opts.profile} (${profileDir})`);
  log(`設定 commit: ${conditions.configCommitSha}${configDirty ? " ※未コミットの変更あり" : ""}`);
  log(`Claude Code: ${conditions.claudeCodeVersion} / model=${opts.model} effort=${opts.effort} permission-mode=${opts.permissionMode}`);
  log(`アーム: ${arms.map((a) => a.id).join(", ")}`);
  log(`タスク: ${tasks.map((t) => t.id).join(", ")}`);
  log(`総実行数: ${arms.length * tasks.length * opts.repeat}`);
  if (opts.repeat < 3) log("注意: --repeat が 3 未満。アーム間の差をノイズと区別できない。");

  // ---- アームごとの設定ディレクトリを 1 度だけ組む ----
  const configDirs = {};
  for (const arm of arms) {
    const d = join(runDir, "configs", arm.id);
    const included = buildArmConfig(arm, armsSpec, profileDir, d);
    if (opts.copyCredentials) {
      const ok = copyCredentials(d);
      log(`  ${arm.id}: 認証情報を複製 ${ok ? "した" : "できなかった (元ファイルが無い)"}`);
    }
    configDirs[arm.id] = d;
    log(`  ${arm.id}: ${included.length ? included.join(", ") : "(何も入れない)"}`);
  }

  if (opts.dryRun) { log("\n--dry-run のためここで終了。run.json と configs/ だけ書き出した。"); return; }

  const metas = [];
  for (const task of tasks) {
    log(`\nタスク: ${task.id}`);
    for (const arm of arms) {
      for (let rep = 1; rep <= opts.repeat; rep++) {
        metas.push(runOne({ task, arm, rep, opts, configDir: configDirs[arm.id], runDir }));
      }
    }
  }

  writeFileSync(join(runDir, "cases.jsonl"), metas.map((m) => JSON.stringify(m)).join("\n") + "\n");
  const finished = { ...conditions, finishedAt: new Date().toISOString(), caseCount: metas.length };
  writeFileSync(join(runDir, "run.json"), JSON.stringify(finished, null, 2) + "\n");

  log(`\n完了。${metas.length} 件。`);
  log(`集計: node eval/analyze.mjs ${runDir}`);
}

main();
