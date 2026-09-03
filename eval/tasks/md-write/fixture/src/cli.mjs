#!/usr/bin/env node
// 期間を指定してレコードを書き出す CLI。
import { writeFileSync } from "node:fs";
import { collect } from "./collect.mjs";

const USAGE = "csv-export --since <YYYY-MM-DD> [--until <YYYY-MM-DD>] [--format csv|json] [--out <path>] [--quiet]";

export function parseArgs(argv) {
  const opts = {
    since: null,
    until: new Date().toISOString().slice(0, 10), // 省略時は今日
    format: "csv",                                // 省略時は csv
    out: null,                                    // 省略時は標準出力
    quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--since": opts.since = argv[++i]; break;
      case "--until": opts.until = argv[++i]; break;
      case "--format": opts.format = argv[++i]; break;
      case "--out": opts.out = argv[++i]; break;
      case "--quiet": opts.quiet = true; break;
      default: throw new Error(`不明なオプション: ${argv[i]}\n${USAGE}`);
    }
  }
  if (!opts.since) throw new Error(`--since は必須\n${USAGE}`);
  if (!["csv", "json"].includes(opts.format)) throw new Error(`--format は csv か json\n${USAGE}`);
  if (opts.since > opts.until) throw new Error("--since が --until より後になっている");
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const body = collect(opts);
  if (opts.out) writeFileSync(opts.out, body);
  else process.stdout.write(body);
  if (!opts.quiet && opts.out) process.stderr.write(`書き出した: ${opts.out}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
