#!/usr/bin/env node
// claude-config 評価ハーネス — 集計。
//
//   node eval/analyze.mjs <run-dir>
//
// runner.mjs が書いた生ログを読んで、指標を JSONL / CSV / Markdown に落とす。
// 実行とは分離してあるので、指標の定義を変えたら再集計するだけでよい。
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanCommand } from "./danger-patterns.mjs";

const EVAL_DIR = dirname(fileURLToPath(import.meta.url));

const runDir = process.argv[2];
if (!runDir || !existsSync(join(runDir, "run.json"))) {
  console.error("使い方: node eval/analyze.mjs <run-dir>   (run.json のあるディレクトリ)");
  process.exit(1);
}

const run = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8"));

// ---------------------------------------------------------------- stream.jsonl を読む

function parseStream(path) {
  const out = {
    init: null,
    toolCalls: 0, toolCallsByName: {}, toolErrors: 0,
    shellCommands: [],
    touchedPaths: [],
    subagentCalls: 0, skillCalls: 0,
    hooksFired: 0, hookDenies: 0, hookDenyReasons: [],
    result: null,
    parseErrors: 0,
  };
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let m;
    try { m = JSON.parse(line); } catch { out.parseErrors++; continue; }

    if (m.type === "system" && m.subtype === "init") { out.init = m; continue; }

    if (m.type === "system" && m.subtype === "hook_started") { out.hooksFired++; continue; }
    if (m.type === "system" && m.subtype === "hook_response") {
      let dec = null;
      try { dec = JSON.parse(m.output || "{}")?.hookSpecificOutput?.permissionDecision; } catch { /* 非 JSON 出力のフックもある */ }
      if (dec === "deny") {
        out.hookDenies++;
        try { out.hookDenyReasons.push(JSON.parse(m.output).hookSpecificOutput.permissionDecisionReason); } catch { /* 理由が取れなくても件数は数える */ }
      }
      continue;
    }

    if (m.type === "assistant") {
      for (const c of m.message?.content || []) {
        if (c.type !== "tool_use") continue;
        out.toolCalls++;
        out.toolCallsByName[c.name] = (out.toolCallsByName[c.name] || 0) + 1;
        if (c.name === "Task" || c.name === "Agent") out.subagentCalls++;
        if (c.name === "Skill") out.skillCalls++;
        if ((c.name === "Bash" || c.name === "PowerShell") && typeof c.input?.command === "string") {
          out.shellCommands.push(c.input.command);
        }
        for (const key of ["file_path", "notebook_path", "path", "pattern"]) {
          const v = c.input?.[key];
          if (typeof v === "string" && v) out.touchedPaths.push(v);
        }
      }
      continue;
    }

    if (m.type === "user") {
      for (const c of m.message?.content || []) if (c.type === "tool_result" && c.is_error) out.toolErrors++;
      continue;
    }

    if (m.type === "result") { out.result = m; continue; }
  }
  return out;
}

// ---------------------------------------------------------------- 1 ケース分の指標

const globToRe = (g) =>
  new RegExp("^" + g.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*") + "$");

// --- rules が「実際に読み込まれる状況だったか」の判定 -------------------------------
// rules/*.md は paths に一致するファイルを触ったときにだけ読み込まれる。読み込みイベントは
// ストリームに出ないので、モデルが触ったファイルとグロブを突き合わせて推定する。
// これが空なら「効果が無かった」ではなく「タスクがその rule を発火させていない」。

// glob を正規表現にする。brace 展開してから 1 文字ずつ見る。
// (この関数の説明にグロブの実例を書くと、コメントが途中で閉じるので書かない)
function ruleGlobToRe(glob) {
  const expand = (g) => {
    const m = /\{([^{}]*)\}/.exec(g);
    if (!m) return [g];
    return m[1].split(",").flatMap((alt) => expand(g.slice(0, m.index) + alt + g.slice(m.index + m[0].length)));
  };
  const SPECIAL = ".+?^${}()|[]\\";
  const one = (g) => {
    let out = "";
    for (let i = 0; i < g.length; i++) {
      const c = g[i];
      if (c === "*") {
        if (g[i + 1] === "*" && g[i + 2] === "/") { out += "(?:.*/)?"; i += 2; }
        else if (g[i + 1] === "*") { out += ".*"; i += 1; }
        else out += "[^/]*";
      } else if (SPECIAL.includes(c)) out += "\\" + c;
      else out += c;
    }
    return out;
  };
  return new RegExp("^(?:" + expand(glob).map(one).join("|") + ")$");
}

/** アームの設定ディレクトリから rules の paths を読む。 */
function loadArmRules(armId) {
  const dir = join(runDir, "configs", armId, "rules");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith(".md")).map((n) => {
    const fm = /^---\n([\s\S]*?)\n---/.exec(readFileSync(join(dir, n), "utf8"));
    const globs = fm ? [...fm[1].matchAll(/^\s*-\s*["']?(.+?)["']?\s*$/gm)].map((m) => m[1]) : [];
    return { file: `rules/${n}`, res: globs.map(ruleGlobToRe) };
  });
}
const armRulesCache = {};
const armRules = (armId) => (armRulesCache[armId] ||= loadArmRules(armId));

function matchesAny(path, globs) {
  return globs.some((g) => (g.includes("*") ? globToRe(g).test(path) : g === path));
}

function metricsFor(meta) {
  const caseDir = join(runDir, "cases", meta.key);
  const s = parseStream(join(caseDir, "stream.jsonl"));
  const r = s.result || {};
  const u = r.usage || {};

  // 危険・禁止操作: ハーネス側のパターンで走査する (評価対象のフックの判定は使わない)
  const hits = [];
  for (const cmd of s.shellCommands) {
    for (const h of scanCommand(cmd)) hits.push({ ...h, command: cmd.slice(0, 300) });
  }
  // フックに拒否された tool_use は result.permission_denials に載る。
  const deniedCmds = new Set(
    (r.permission_denials || []).map((d) => d.tool_input?.command).filter(Boolean)
  );
  const dangerBlocked = hits.filter((h) => deniedCmds.has(h.command) || [...deniedCmds].some((c) => c.startsWith(h.command.slice(0, 100)))).length;

  const changed = meta.workspace?.changedFiles || [];
  const expected = meta.expectedFiles || [];
  const unexpected = expected.length ? changed.filter((f) => !matchesAny(f, expected)) : [];

  const v = meta.verify || {};

  return {
    run_id: run.runId,
    profile: run.profile,
    config_sha: run.configCommitSha,
    config_dirty: run.configWorkingTreeDirty,
    claude_version: run.claudeCodeVersion,
    model_requested: run.model,
    model_resolved: s.init?.model || "",
    effort: run.effort,
    permission_mode: run.permissionMode,

    key: meta.key, task: meta.task, arm: meta.arm, rep: meta.rep,

    // --- アームが実際に読み込まれたかの検証 ---
    loaded_skills: (s.init?.skills || []).length,
    loaded_agents: (s.init?.agents || []).length,
    rules_activated: (() => {
      const cwd = (s.init?.cwd || "").split("\\").join("/");
      const rel = s.touchedPaths.map((p) => {
        const q = p.split("\\").join("/");
        return cwd && q.startsWith(cwd + "/") ? q.slice(cwd.length + 1) : q.replace(/^\.\//, "");
      });
      return armRules(meta.arm).filter((r) => rel.some((f) => r.res.some((re) => re.test(f)))).map((r) => r.file).join(" ");
    })(),

    // --- 成否 ---
    completed: r.subtype === "success" && !r.is_error && meta.spawn?.status === 0,
    result_subtype: r.subtype || (meta.spawn?.timedOut ? "timeout" : "no-result"),
    task_success: v.success === true,
    build_ok: v.build === undefined ? "" : v.build === true,
    test_ok: v.test === undefined ? "" : v.test === true,
    verify_notes: (v.notes || []).join(" / "),

    // --- 変更の広がり ---
    files_changed: changed.length,
    unexpected_files_changed: unexpected.length,
    unexpected_files: unexpected.join(" "),
    commits_made: (meta.workspace?.commits || []).length,
    branch_after: meta.workspace?.branch || "",

    // --- 手数 ---
    tool_calls: s.toolCalls,
    tool_errors: s.toolErrors,
    subagent_calls: s.subagentCalls,
    skill_calls: s.skillCalls,
    num_turns: r.num_turns ?? "",

    // --- 危険・禁止操作 ---
    danger_attempts: hits.filter((h) => h.kind === "danger").length,
    policy_attempts: hits.filter((h) => h.kind === "policy").length,
    danger_blocked: dangerBlocked,
    danger_ids: [...new Set(hits.map((h) => h.id))].join(" "),
    hooks_fired: s.hooksFired,
    hook_denies: s.hookDenies,
    permission_denials: (r.permission_denials || []).length,

    // --- コスト ---
    input_tokens: u.input_tokens ?? "",
    output_tokens: u.output_tokens ?? "",
    cache_read_tokens: u.cache_read_input_tokens ?? "",
    cache_creation_tokens: u.cache_creation_input_tokens ?? "",
    total_tokens: [u.input_tokens, u.output_tokens, u.cache_read_input_tokens, u.cache_creation_input_tokens]
      .reduce((a, b) => a + (Number(b) || 0), 0),
    cost_usd: r.total_cost_usd ?? "",

    // --- 時間 ---
    duration_ms: r.duration_ms ?? "",
    duration_api_ms: r.duration_api_ms ?? "",
    wall_ms: meta.wallMs ?? "",

    // --- 自動取得できないもの (human-review.csv から埋める) ---
    human_fix_count: "",
    human_notes: "",

    _verify: v,
    _hits: hits,
    _hookDenyReasons: s.hookDenyReasons,
  };
}

// ---------------------------------------------------------------- 読み込み

// 完走していれば cases.jsonl、途中なら cases.partial.jsonl、どちらも無ければ各ケースの meta.json。
function loadMetas() {
  for (const name of ["cases.jsonl", "cases.partial.jsonl"]) {
    const p = join(runDir, name);
    if (existsSync(p)) return readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  }
  const casesDir = join(runDir, "cases");
  if (!existsSync(casesDir)) { console.error("結果が 1 件も無い"); process.exit(1); }
  return readdirSync(casesDir)
    .map((d) => join(casesDir, d, "meta.json"))
    .filter((p) => existsSync(p))
    .map((p) => JSON.parse(readFileSync(p, "utf8")));
}
const metas = loadMetas();
const rows = metas.map(metricsFor);

// 人手評価の突き合わせ (あれば)
const reviewPath = join(runDir, "human-review.csv");
if (existsSync(reviewPath)) {
  const lines = readFileSync(reviewPath, "utf8").split("\n").filter((l) => l.trim());
  const head = lines[0].split(",");
  const iKey = head.indexOf("key"), iFix = head.indexOf("human_fix_count"), iNote = head.indexOf("human_notes");
  for (const l of lines.slice(1)) {
    const cells = splitCsv(l);
    const row = rows.find((r) => r.key === cells[iKey]);
    if (!row) continue;
    if (iFix >= 0 && cells[iFix] !== undefined) row.human_fix_count = cells[iFix];
    if (iNote >= 0 && cells[iNote] !== undefined) row.human_notes = cells[iNote];
  }
}

function splitCsv(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// ---------------------------------------------------------------- 出力

const CSV_COLS = Object.keys(rows[0] || {}).filter((k) => !k.startsWith("_"));
const csvCell = (v) => {
  const s = v === true ? "true" : v === false ? "false" : String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.split('"').join('""')}"` : s;
};

writeFileSync(join(runDir, "metrics.jsonl"), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
writeFileSync(
  join(runDir, "results.csv"),
  [CSV_COLS.join(","), ...rows.map((r) => CSV_COLS.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n"
);

if (!existsSync(reviewPath)) {
  writeFileSync(
    reviewPath,
    ["key,task,arm,rep,human_fix_count,human_notes",
     ...rows.map((r) => `${r.key},${r.task},${r.arm},${r.rep},,`)].join("\n") + "\n"
  );
}

// ---- 集計 ----
const num = (v) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt = (v, d = 1) => (v === null ? "-" : v.toFixed(d));

function agg(subset) {
  const n = subset.length;
  const pick = (k) => subset.map((r) => num(r[k])).filter((v) => v !== null);
  const rate = (k) => (n ? subset.filter((r) => r[k] === true).length / n : null);
  const humans = pick("human_fix_count");
  return {
    n,
    success: rate("task_success"),
    completed: rate("completed"),
    build: (() => { const s = subset.filter((r) => r.build_ok !== ""); return s.length ? s.filter((r) => r.build_ok === true).length / s.length : null; })(),
    test: (() => { const s = subset.filter((r) => r.test_ok !== ""); return s.length ? s.filter((r) => r.test_ok === true).length / s.length : null; })(),
    unexpected: mean(pick("unexpected_files_changed")),
    files: mean(pick("files_changed")),
    tools: mean(pick("tool_calls")),
    toolErrors: mean(pick("tool_errors")),
    tokens: mean(pick("total_tokens")),
    cost: mean(pick("cost_usd")),
    wall: mean(pick("wall_ms")),
    danger: mean(pick("danger_attempts")),
    policy: mean(pick("policy_attempts")),
    blocked: mean(pick("danger_blocked")),
    human: humans.length ? mean(humans) : null,
    humanN: humans.length,
  };
}

const tasks = [...new Set(rows.map((r) => r.task))];
const arms = run.arms.map((a) => a.id).filter((id) => rows.some((r) => r.arm === id));
const armLabel = Object.fromEntries(run.arms.map((a) => [a.id, a.label]));

const pct = (v) => (v === null ? "-" : `${Math.round(v * 100)}%`);

const md = [];
md.push(`# 評価レポート — ${run.runId}`);
md.push("");
md.push("## 実験条件");
md.push("");
md.push("| 項目 | 値 |");
md.push("| --- | --- |");
md.push(`| プロファイル | \`${run.profile}\` |`);
md.push(`| 設定 commit | \`${run.configCommitSha}\`${run.configWorkingTreeDirty ? " **(未コミットの変更あり — この結果は SHA だけでは再現できない)**" : ""} |`);
md.push(`| Claude Code | \`${run.claudeCodeVersion}\` |`);
md.push(`| model (指定 / 解決後) | \`${run.model}\` / \`${rows[0]?.model_resolved || "-"}\` |`);
md.push(`| effort | \`${run.effort}\` |`);
md.push(`| permission-mode | \`${run.permissionMode}\` |`);
md.push(`| setting-sources | \`${run.settingSources}\` |`);
md.push(`| 反復回数 | ${run.repeat} |`);
md.push(`| OS / Node | ${run.os.platform} ${run.os.release} ${run.os.arch} / ${run.node} |`);
md.push(`| 実行日時 | ${run.startedAt} → ${run.finishedAt || "(未完了)"} |`);
md.push("");
if (run.repeat < 3) {
  md.push("> **反復回数が 3 未満。** 以下の数字はアーム間の差をノイズと区別できない。傾向として読むこと。");
  md.push("");
}

md.push("## アーム");
md.push("");
md.push("| アーム | 内容 | 含む層 |");
md.push("| --- | --- | --- |");
for (const a of run.arms) md.push(`| \`${a.id}\` | ${a.label} | ${a.layers.length ? a.layers.join(", ") : "(なし)"} |`);
md.push("");

for (const task of tasks) {
  const spec = run.tasks.find((t) => t.id === task) || {};
  md.push(`## タスク: ${task}`);
  md.push("");
  md.push(`検証したい層: ${(spec.exercises || []).map((e) => `\`${e}\``).join(", ") || "(未宣言)"} / fixture: \`${spec.fixtureHash || "-"}\` / prompt: \`${spec.promptHash || "(未記録)"}\``);
  md.push("");
  md.push("| アーム | n | 成功率 | build | test | 不要変更 | 変更ファイル | tool call | tool error | token | $ | 実時間 s | 危険 | 禁止 | 阻止 | 人手修正 |");
  md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const arm of arms) {
    const a = agg(rows.filter((r) => r.task === task && r.arm === arm));
    if (!a.n) continue;
    md.push(`| \`${arm}\` | ${a.n} | ${pct(a.success)} | ${pct(a.build)} | ${pct(a.test)} | ${fmt(a.unexpected)} | ${fmt(a.files)} | ${fmt(a.tools)} | ${fmt(a.toolErrors)} | ${a.tokens === null ? "-" : Math.round(a.tokens).toLocaleString("en-US")} | ${a.cost === null ? "-" : a.cost.toFixed(3)} | ${a.wall === null ? "-" : Math.round(a.wall / 1000)} | ${fmt(a.danger)} | ${fmt(a.policy)} | ${fmt(a.blocked)} | ${a.humanN ? fmt(a.human) : "未記入"} |`);
  }
  md.push("");
}

// ---- タスク固有の指標 (verify.mjs が返した数値のうち、上の表に出ていないもの) ----
const SKIP_KEYS = new Set(["success", "build", "test", "ran", "styleBaseline"]);
for (const task of tasks) {
  const sub = rows.filter((r) => r.task === task);
  const keys = [...new Set(sub.flatMap((r) => Object.entries(r._verify || {})
    .filter(([k, v]) => typeof v === "number" && !SKIP_KEYS.has(k)).map(([k]) => k)))];
  // 真偽値も指標として出す (collateralDamage, dataLoss など)。発生率で見る。
  const boolKeys = [...new Set(sub.flatMap((r) => Object.entries(r._verify || {})
    .filter(([k, v]) => typeof v === "boolean" && !SKIP_KEYS.has(k)).map(([k]) => k)))];
  if (!keys.length && !boolKeys.length) continue;
  md.push(`### ${task} のタスク固有指標`);
  md.push("");
  const baseline = sub.find((r) => r._verify?.styleBaseline !== undefined)?._verify?.styleBaseline;
  if (baseline !== undefined) md.push(`\`styleViolations\` の fixture 初期値: **${baseline}**`);
  md.push("");
  const cols = [...keys, ...boolKeys.map((k) => `${k} 率`)];
  md.push(`| アーム | ${cols.join(" | ")} |`);
  md.push(`| --- | ${cols.map(() => "---:").join(" | ")} |`);
  for (const arm of arms) {
    const s2 = sub.filter((r) => r.arm === arm);
    if (!s2.length) continue;
    const nums = keys.map((k) => {
      const xs = s2.map((r) => r._verify?.[k]).filter((v) => typeof v === "number");
      return xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : "-";
    });
    const bools = boolKeys.map((k) => {
      const xs = s2.map((r) => r._verify?.[k]).filter((v) => typeof v === "boolean");
      return xs.length ? `${Math.round((xs.filter(Boolean).length / xs.length) * 100)}%` : "-";
    });
    md.push(`| \`${arm}\` | ${[...nums, ...bools].join(" | ")} |`);
  }
  md.push("");
}

// ---- 宣言された比較の差分 ----
// 2 群の比率差は正規近似 (連続修正なし)。n が小さいので「差ありと言えるか」の目安にしか使わない。
function propTest(k1, n1, k2, n2) {
  if (!n1 || !n2) return null;
  const p1 = k1 / n1, p2 = k2 / n2;
  const p = (k1 + k2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return { diff: p2 - p1, z: 0, significant: false };
  const z = (p2 - p1) / se;
  return { diff: p2 - p1, z, significant: Math.abs(z) >= 1.96 && n1 >= 5 && n2 >= 5 };
}
const sd = (xs) => {
  if (xs.length < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};

/**
 * 追加した層が、その実行で実際に発火したかを数える。
 * ここが 0 なら「設定が効かなかった」ではなく「タスクがその設定を発火させていない」。
 * どちらなのかを取り違えると、効いていない設定を捨てる判断も、効くはずの設定を諦める判断も間違う。
 */
function activation(measures, treatmentRows) {
  const n = treatmentRows.length;
  const count = (f) => treatmentRows.filter(f).length;
  if (measures === "CLAUDE.md" || measures.startsWith("claudemd")) {
    return { fired: null, label: `常時 (${n}/${n})` }; // システムプロンプトに載るので必ず効いている
  }
  if (measures.startsWith("rules")) {
    const file = measures.includes("/") ? measures : null;
    const k = count((r) => (file ? String(r.rules_activated).includes(file.split("/").pop()) : String(r.rules_activated).trim() !== ""));
    return { fired: k > 0, label: `${k}/${n}` };
  }
  if (measures.startsWith("skills")) { const k = count((r) => r.skill_calls > 0); return { fired: k > 0, label: `${k}/${n}` }; }
  if (measures.startsWith("agents")) { const k = count((r) => r.subagent_calls > 0); return { fired: k > 0, label: `${k}/${n}` }; }
  if (measures.startsWith("hooks")) { const k = count((r) => r.hooks_fired > 0); return { fired: k > 0, label: `${k}/${n}` }; }
  return { fired: null, label: "-" };
}

md.push("## 宣言された比較");
md.push("");
md.push("タスクごとに `task.json` が「この差分を測りたい」と宣言したペアだけを並べる。");
md.push("成功率の差は 2 群の比率差の正規近似 (|z| >= 1.96 かつ両群 n >= 5 で「差あり」)。");
md.push("n が小さいので、これは検定というより**差を主張してよいかの足切り**として読むこと。");
md.push("");
md.push("「発火」列は、追加した層がその実行で実際に動いた回数。ここが 0 なら結論は");
md.push("「効果が無い」ではなく**「このタスクがその設定を発火させていない」**。判定は次のどれか:");
md.push("");
md.push("- `常時` — CLAUDE.md はシステムプロンプトに載るので必ず効いている");
md.push("- rules — `paths` に一致するファイルをモデルが触った実行数 (触ったファイルとグロブの突き合わせによる推定)");
md.push("- skills — `Skill` ツールを呼んだ実行数");
md.push("- agents — サブエージェントを起動した実行数");
md.push("- hooks — `hook_started` が出た実行数");
md.push("");
let anyComparison = false;
for (const task of tasks) {
  const spec = run.tasks.find((t) => t.id === task);
  const comps = spec?.comparisons || [];
  if (!comps.length) continue;
  anyComparison = true;
  md.push(`### ${task}`);
  md.push("");
  if (spec.armsWhy) md.push(`回すアームの選び方: ${spec.armsWhy}`);
  md.push("");
  md.push("| 測る対象 | 対照 → 追加 | 発火 | 成功 | 差 | 判定 | token 変化 | $ 変化 | 実時間 変化 | tool call 変化 |");
  md.push("| --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: |");
  for (const c of comps) {
    const b = rows.filter((r) => r.task === task && r.arm === c.baseline);
    const t = rows.filter((r) => r.task === task && r.arm === c.treatment);
    if (!b.length || !t.length) { md.push(`| \`${c.measures}\` | \`${c.baseline}\` → \`${c.treatment}\` | (未実行) | - | - | - | - | - | - |`); continue; }
    const kb = b.filter((r) => r.task_success === true).length;
    const kt = t.filter((r) => r.task_success === true).length;
    const st = propTest(kb, b.length, kt, t.length);
    const delta = (key) => {
      const xb = b.map((r) => num(r[key])).filter((v) => v !== null);
      const xt = t.map((r) => num(r[key])).filter((v) => v !== null);
      if (!xb.length || !xt.length) return "-";
      const mb = xb.reduce((a, x) => a + x, 0) / xb.length;
      const mt = xt.reduce((a, x) => a + x, 0) / xt.length;
      if (mb === 0) return mt === 0 ? "±0%" : "+∞";
      const pctChange = ((mt - mb) / mb) * 100;
      return `${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(0)}%`;
    };
    const act = activation(c.measures, t);
    const verdict = act.fired === false ? "**発火せず**"
      : st === null ? "-"
      : st.significant ? (st.diff > 0 ? "**改善**" : "**悪化**")
      : "差を主張できない";
    md.push(`| \`${c.measures}\` | \`${c.baseline}\` → \`${c.treatment}\` | ${act.label} | ${kb}/${b.length} → ${kt}/${t.length} | ${st ? (st.diff * 100).toFixed(0) + "pt" : "-"} | ${verdict} | ${delta("total_tokens")} | ${delta("cost_usd")} | ${delta("wall_ms")} | ${delta("tool_calls")} |`);
  }
  md.push("");
  for (const c of comps) md.push(`- \`${c.measures}\` — ${c.why}`);
  md.push("");
}
if (!anyComparison) { md.push("`task.json` に `comparisons` の宣言が無い。"); md.push(""); }

md.push("## 全タスク合計");
md.push("");
md.push("| アーム | n | 成功率 | 不要変更 | tool call | token | $ | 実時間 s | 危険 | 禁止 | 阻止 |");
md.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
for (const arm of arms) {
  const a = agg(rows.filter((r) => r.arm === arm));
  if (!a.n) continue;
  md.push(`| \`${arm}\` (${armLabel[arm]}) | ${a.n} | ${pct(a.success)} | ${fmt(a.unexpected)} | ${fmt(a.tools)} | ${a.tokens === null ? "-" : Math.round(a.tokens).toLocaleString("en-US")} | ${a.cost === null ? "-" : a.cost.toFixed(3)} | ${a.wall === null ? "-" : Math.round(a.wall / 1000)} | ${fmt(a.danger)} | ${fmt(a.policy)} | ${fmt(a.blocked)} |`);
}
md.push("");

// ---- 危険操作の内訳 ----
const allHits = rows.flatMap((r) => r._hits.map((h) => ({ ...h, arm: r.arm, task: r.task, key: r.key })));
md.push("## 危険・禁止操作の内訳");
md.push("");
if (!allHits.length) {
  md.push("この run では 1 件も検出されなかった。");
} else {
  md.push("| パターン | 種別 | 件数 | 出たアーム |");
  md.push("| --- | --- | ---: | --- |");
  const byId = {};
  for (const h of allHits) (byId[h.id] ||= []).push(h);
  for (const [id, hs] of Object.entries(byId).sort((a, b) => b[1].length - a[1].length)) {
    md.push(`| \`${id}\` | ${hs[0].kind} | ${hs.length} | ${[...new Set(hs.map((h) => h.arm))].sort().join(", ")} |`);
  }
}
md.push("");
const denyReasons = rows.flatMap((r) => r._hookDenyReasons.map((x) => ({ arm: r.arm, reason: x })));
if (denyReasons.length) {
  md.push("### フックが実際に拒否した内容");
  md.push("");
  for (const d of denyReasons.slice(0, 30)) md.push(`- \`${d.arm}\` — ${d.reason}`);
  md.push("");
}

// ---- 層が実際に効いているかの検査 ----
md.push("## 検査");
md.push("");
const notes = [];
const declaredLayers = new Set(run.tasks.flatMap((t) => t.exercises || []));
// exercises はファイル名で書く (`hooks/guard-bash.mjs`)。層の名前 (`settings`) と対応付ける。
const LAYER_PREFIXES = {
  claudemd: ["CLAUDE.md"],
  rules: ["rules"],
  skills: ["skills"],
  agents: ["agents"],
  settings: ["settings", "hooks"],
};
for (const a of run.arms) {
  for (const layer of a.layers) {
    const prefixes = LAYER_PREFIXES[layer] || [layer];
    const touched = [...declaredLayers].some((d) => prefixes.some((p) => d === p || d.startsWith(p + "/") || d === p));
    if (!touched) notes.push(`- アーム \`${a.id}\` は層 \`${layer}\` を含むが、どのタスクの \`exercises\` もそれを宣言していない。この run ではこの層の差は測れていない。`);
  }
}
for (const arm of arms) {
  const sub = rows.filter((r) => r.arm === arm);
  const withHooks = run.arms.find((a) => a.id === arm)?.layers.includes("settings");
  if (withHooks && sub.every((r) => r.hooks_fired === 0)) {
    notes.push(`- アーム \`${arm}\` は hooks を含むが、\`hook_started\` イベントが 1 件も出ていない。フックが読み込まれていない可能性がある (パス解決の失敗、または permission-mode がフックを迂回している)。\`node eval/selfcheck.mjs\` で確かめること。`);
  }
  if (sub.some((r) => r.skill_calls > 0)) notes.push(`- アーム \`${arm}\` で Skill ツールの呼び出しを ${sub.reduce((a, r) => a + r.skill_calls, 0)} 件検出。`);
  if (sub.some((r) => r.subagent_calls > 0)) notes.push(`- アーム \`${arm}\` でサブエージェントの起動を ${sub.reduce((a, r) => a + r.subagent_calls, 0)} 件検出。`);
}
const timeouts = rows.filter((r) => r.result_subtype === "timeout" || !r.completed);
if (timeouts.length) notes.push(`- 正常終了しなかったケースが ${timeouts.length} 件ある: ${timeouts.map((r) => r.key).join(", ")}`);
md.push(notes.length ? [...new Set(notes)].join("\n") : "- 特記事項なし");
md.push("");

md.push("## この数字で測れていないもの");
md.push("");
md.push("- **人間による修正が必要だった回数** — 自動取得できない。`human-review.csv` に手で記入し、`analyze.mjs` を再実行すると表に反映される。");
md.push(`- **permissions.allow / ask の効果** — \`--permission-mode ${run.permissionMode}\` では「聞かずに通す」に吸収されるため測っていない。${run.permissionMode === "dontAsk" ? "deny は効く (実測確認済み)。" : "bypassPermissions では deny も迂回される。"}`);
md.push("- **危険・禁止操作の件数** — 文字列パターンによる近似 (`eval/danger-patterns.mjs`)。スクリプト経由の実行は見逃し、引用符の中の文字列は誤検出しうる。");
md.push("- **タスク成功の判定** — `verify.mjs` の決定的なチェックのみ。コードの読みやすさ・設計の妥当性は含まない。");
md.push("- **token 使用量** — サブエージェントの消費は親の `usage` に合算されて返る。アーム間で内訳までは分離していない。");
md.push("");

writeFileSync(join(runDir, "report.md"), md.join("\n"));

console.log(`書き出した:
  ${join(runDir, "metrics.jsonl")}
  ${join(runDir, "results.csv")}
  ${join(runDir, "report.md")}
  ${reviewPath}${existsSync(reviewPath) ? "" : " (新規)"}`);
console.log("\n" + md.slice(md.indexOf("## 全タスク合計")).join("\n"));
