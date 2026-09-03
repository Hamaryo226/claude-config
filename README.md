# claude-config

Claude Code の設定を管理するリポジトリ。個人開発用と会社用の 2 つのプロファイルを持つ。

| プロファイル | 場所 | 状態 |
| --- | --- | --- |
| **個人開発用** | リポジトリのルート | この PC の `~/.claude` そのもの。常に有効 |
| **会社用** | [`work/`](work/) | 会社 PC の `~/.claude` に配置するテンプレート。この PC では動かない |

リポジトリのルートがそのまま `~/.claude` なので、ルートのファイルを編集すればすぐ反映される。
会社用は `work/install.ps1` (Windows) または `work/install.sh` (Linux/macOS) で
会社 PC の `~/.claude` に展開する。手順と個人用との差分は [`work/README.md`](work/README.md) にある。

以下はルート (個人開発用) の説明。

## 中身

| パス | 役割 | 読み込まれるタイミング |
| --- | --- | --- |
| `CLAUDE.md` | 全プロジェクト共通の指示 | 毎セッションの開始時 |
| `rules/*.md` | 言語・ファイル種別ごとの規約 | `paths` に一致するファイルを読んだ時だけ |
| `agents/*.md` | サブエージェントの定義 | 呼び出された時 |
| `skills/*/SKILL.md` | スラッシュコマンド | `/commit` などで起動した時 |
| `hooks/*.mjs` | ライフサイクルフック | 対応するイベント発生時 |
| `statusline.mjs` | ステータスライン | 常時 (30 秒ごとに更新) |
| `settings.json` | 権限・フック登録・プラグイン | 起動時 (一部は保存時に即反映) |

`eval/` は設定そのものではなく、この設定が効いているかを測るための評価基盤。
中身と使い方は [`eval/README.md`](eval/README.md) を見ること。

### rules

`paths` フロントマターで対象ファイルを絞っている。一致するファイルを Claude が読んだ時だけ
コンテキストに載るので、常時のトークン消費がない。

- `dotnet.md` — `**/*.cs`, `**/*.csproj`, `**/*.sln`, `**/*.razor`
- `web.md` — TypeScript / JavaScript / Astro / Svelte / Vue / `package.json`
- `markdown-ja.md` — `**/*.md`, `**/*.mdx`

### agents

- `test-runner` — ビルドとテストを走らせて失敗を切り分ける (コードは直さない)
- `docs-ja` — 日本語ドキュメントの作成と更新 (コードは触らない)
- `lib-scout` — ライブラリと API の最新仕様を公式ドキュメントで調べる (ファイルを変更しない)

### skills

- `/commit` — 変更を論理単位に分けて日本語でコミット (push はしない)
- `/pr` — 日本語の PR 本文を組み立てて確認後に `gh pr create`
- `/onboard` — リポジトリに `CLAUDE.md` と `.claude/settings.json` の雛形を作る
- `/project-analyze` — 既存プロジェクトを解析し、必要な設定 (CLAUDE.md / rules / skills / agents / settings) だけを生成する
- `/codebase-conventions` — 既存コードを実測して、そのプロジェクト固有の書き方を `.claude/rules/` に抽出する
- `/release` — バージョン更新・リリースノート・タグ作成

### hooks

- `guard-bash.mjs` (PreToolUse) — `rm -rf` / `reset --hard` / `--force` push / `--no-verify` などを実行前に拒否
- `format-on-edit.mjs` (PostToolUse) — 編集したファイルを整形。`dotnet format` / prettier / eslint。
  **リポジトリに設定がある場合だけ**動く
- `session-start.mjs` (SessionStart) — ブランチ・未コミット変更・直近コミット・ビルドコマンドを自動で読み込む

## 追跡対象の決め方

`.gitignore` は**ホワイトリスト方式**。`/*` で一旦すべて無視し、追跡したいものだけを `!` で戻している。

この方式にしている理由は、`~/.claude` に `.credentials.json` (OAuth トークン) と
`history.jsonl` / `projects/` (会話履歴と自動メモリ) が同居しているため。
うっかり `git add -A` しても、これらがステージに乗ることがない。

**追跡するファイルを増やすときは `.gitignore` に `!` の行を足す。** 足さない限り追跡されない。

## 別のマシンに復元する

`~/.claude` は Claude Code が自分で作るので、clone ではなく既存ディレクトリに後付けする。

```bash
cd ~/.claude
git init
git remote add origin git@github.com:Hamaryo226/claude-config.git
git fetch origin
git checkout -f main
```

その後、必要に応じて言語サーバーを入れる。

```bash
dotnet tool install --global csharp-ls
```

```bash
npm install -g typescript-language-server typescript
```

## 別マシンで直す必要があるところ

`settings.json` の `statusLine.command` と `hooks` の `args` は
`C:/Users/hama/.claude/...` の絶対パスで書いてある。

- Windows でユーザー名が違うマシン → パスを書き換える
- macOS / Linux → `/home/<user>/.claude/...` に書き換える。フックのスクリプト自体は
  Node で書いてあるのでそのまま動く

`CLAUDE.md` にもこのマシン固有の内容 (Windows 11 / PowerShell 7 / `jq` と `rg` が無い /
作業リポジトリの置き場所) が書いてあるので、環境が変わったら直す。

## 追跡していないもの

再インストールできるもの、マシンごとに違うもの、秘密情報は追跡していない。

- `.credentials.json` — OAuth トークン
- `history.jsonl`, `sessions/`, `projects/` — 会話履歴と自動メモリ
- `plugins/` — プラグインとマーケットプレイスのキャッシュ
- `skills/find-skills`, `skills/logo-generator`, `skills/microsoft-foundry` — 配布元から入れ直せる
- `cache/`, `backups/`, `downloads/`, `shell-snapshots/`, `plans/`

## 参考

- [Claude Code settings](https://code.claude.com/docs/en/settings)
- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Memory と rules](https://code.claude.com/docs/en/memory)
- [Subagents](https://code.claude.com/docs/en/sub-agents)
- [Skills](https://code.claude.com/docs/en/skills)
