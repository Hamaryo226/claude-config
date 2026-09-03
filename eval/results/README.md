# results — 実行済みの評価結果

`eval/analyze.mjs` が出した `run.json` / `report.md` / `results.csv` / `metrics.jsonl` を run ごとに置く。
**生ログ (`stream.jsonl`) と作業コピーは置かない。** 作業対象のコードが丸ごと入るため、
`.gitignore` で `eval/runs/` を除外してある。手元で読み直したいときは `--out` で出した先を見ること。

| run | プロファイル | model | 実行数 | 一言 |
| --- | --- | --- | ---: | --- |
| [`2026-09-02T22-23-09-706Z_work`](2026-09-02T22-23-09-706Z_work/) | `work` | `claude-sonnet-5` | 60 | 初回。設定の効果は 1 タスクでしか出ず、3 タスクは設計不備で差が出なかった |

各ディレクトリの `report.md` が比較表、`results.csv` が 1 実行 1 行の生値、
`selfcheck.txt` がそのときの `guard-bash.mjs` の穴の一覧。
