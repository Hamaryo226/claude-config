import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const EVAL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUNNER = join(EVAL_DIR, "runner.mjs");
const ANALYZE = join(EVAL_DIR, "analyze.mjs");

test("resume 中断後も既存の後続ケースを cases.jsonl に保持する", () => {
  const tmp = mkdtempSync(join(tmpdir(), "claude-config-runner-test-"));
  const bin = join(tmp, "bin");
  mkdirSync(bin);
  const fake = join(bin, "claude");
  const state = join(tmp, "count.txt");
  writeFileSync(state, "0\n");
  writeFileSync(fake, `#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
if (args.includes("--version")) { console.log("2.1.test"); process.exit(0); }
const state = process.env.FAKE_CLAUDE_STATE;
const phase = process.env.FAKE_CLAUDE_PHASE;
const count = Number(readFileSync(state, "utf8")) + 1;
writeFileSync(state, String(count));
const limited = phase === "first" ? [2, 4, 6].includes(count) : [8, 9, 10].includes(count);
console.log(JSON.stringify({ type: "system", subtype: "init", model: "fake-sonnet", cwd: process.cwd(), skills: [], agents: [] }));
console.log(JSON.stringify({ type: "result", subtype: "success", is_error: limited, result: limited ? "rate limit" : "ok", usage: {} }));
process.exit(limited ? 1 : 0);
`);
  chmodSync(fake, 0o755);

  const out = join(tmp, "run");
  const baseArgs = [RUNNER, "--tasks", "ts-bugfix", "--arms", "a0-bare", "--repeat", "7", "--no-shuffle", "--no-keep-workspace", "--out", out];
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_CLAUDE_STATE: state, FAKE_CLAUDE_PHASE: "first" };
  execFileSync(process.execPath, baseArgs, { env, stdio: "pipe" });
  assert.equal(readFileSync(join(out, "cases.jsonl"), "utf8").trim().split("\n").length, 7);
  execFileSync(process.execPath, [ANALYZE, out], { env, stdio: "pipe" });
  assert.match(readFileSync(join(out, "report.md"), "utf8"), /Fisher 正確確率検定/);

  env.FAKE_CLAUDE_PHASE = "resume";
  execFileSync(process.execPath, [...baseArgs, "--resume"], { env, stdio: "pipe" });
  const cases = readFileSync(join(out, "cases.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(cases.length, 7);
  assert.ok(cases.some((x) => x.rep === 7 && x.rateLimited === false), "中断位置より後ろの既存ケースを保持する");
  const run = JSON.parse(readFileSync(join(out, "run.json"), "utf8"));
  assert.equal(run.aborted, true);
  assert.equal(run.incomplete, true);
  assert.equal(run.rateLimitedCount, 3);

  const before = readFileSync(join(out, "run.json"), "utf8");
  const incompatible = spawnSync(process.execPath, [...baseArgs, "--resume", "--model", "opus"], { env, encoding: "utf8" });
  assert.notEqual(incompatible.status, 0);
  assert.match(incompatible.stderr, /実験条件が前回と一致しない/);
  assert.equal(readFileSync(join(out, "run.json"), "utf8"), before, "不一致時に既存 run.json を上書きしない");

  env.CLAUDE_CODE_USE_BEDROCK = "1";
  const providerMismatch = spawnSync(process.execPath, [...baseArgs, "--resume"], { env, encoding: "utf8" });
  assert.notEqual(providerMismatch.status, 0);
  assert.match(providerMismatch.stderr, /実験条件が前回と一致しない/);
  assert.equal(readFileSync(join(out, "run.json"), "utf8"), before, "プロバイダー不一致時も既存 run.json を上書きしない");
});
