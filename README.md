# claude-config

会社 PC の `~/.claude` に配置する Claude Code プロファイル。
このリポジトリは会社用設定だけを管理し、認証情報・会話履歴は含めない。

## 配置手順

会社 PC でこのリポジトリを取得し、ルートの install スクリプトで `~/.claude` に展開する。

### Windows

```powershell
$env:CLAUDE_CONFIG_REPO_URL = "会社で承認されたリポジトリ URL"
git clone --depth 1 $env:CLAUDE_CONFIG_REPO_URL $env:TEMP\claude-config
cd $env:TEMP\claude-config
.\install.ps1
```

まず引数なしで実行すると **dry-run**（何が配置され、何が退避されるかを表示するだけ）。
内容を確認してから適用する。

```powershell
.\install.ps1 -Apply
```

### Linux / macOS

```bash
export CLAUDE_CONFIG_REPO_URL="会社で承認されたリポジトリ URL"
git clone --depth 1 "$CLAUDE_CONFIG_REPO_URL" /tmp/claude-config
cd /tmp/claude-config && ./install.sh
```

```bash
./install.sh --apply
```

既存の `~/.claude` のファイルは、上書きする前に `.bak-<日時>` として退避される。

## 配置後にやること

1. **`CLAUDE.md` の「この環境について (要記入)」を埋める**
   OS・シェル、作業リポジトリの置き場所、社内 Git ホスト、入っていないコマンド
2. **`settings.json` の `permissions.allow` に社内ドキュメントのドメインを足す**
   例: `"WebFetch(domain:confluence.example.co.jp)"`。既定では公式ドキュメントのみ許可
3. **`settings.json` の `permissions.deny` を会社の事情に合わせる**
   `application-prod*.yml` や `*.tfvars` の読み取りを止めているので、業務上必要なら外す
4. `claude doctor` でエラーが無いことを確認し、新しいセッションで `/status` `/context` を見る

### Bedrock / モデル設定

このテンプレートは `effortLevel: "high"` だけを指定し、モデル ID は固定しない。
会社が割り当てた Sonnet 5 の Bedrock inference profile を managed settings または環境変数で指定する。
このリポジトリに ARN、AWS profile 名、リージョン、認証情報を書かない。

- メインモデル: `ANTHROPIC_MODEL` または managed settings の `model`
- `sonnet` alias の割り当て: `ANTHROPIC_DEFAULT_SONNET_MODEL`
- カスタム ARN で effort が認識されない場合: 管理者側で
  `ANTHROPIC_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES` を設定
- 配置後: `/status` で provider、実モデル、`high` を確認

サブエージェントはモデルと effort を固定せず、メインセッションの設定を継承する。
これにより `model: sonnet` が Bedrock の別バージョンへ解決される事故を避ける。

`skipWebFetchPreflight: true` は、WebFetch 前のホスト名確認を Anthropic 側へ送らないための設定。
`permissions.allow` の明示的なドメイン制限と組み合わせているので、`WebFetch(domain:*)` のような
広い許可へ変えない。品質アンケートも無効化するが、stable channel の更新確認は維持する。

`includeGitInstructions: false` は、組み込み Git 指示とこのプロファイルの `CLAUDE.md` / `/commit` /
SessionStart スナップショットとの重複を避ける設定。独自 Git 指示を削除する場合は再度有効にする。

## `__CLAUDE_DIR__` について

`settings.json` の `statusLine.command` とフックの `args` は `__CLAUDE_DIR__` というプレースホルダで
書いてある。**install スクリプトがこれを実際のパスに置き換える。**
手でコピーした場合は置換されないので、フックとステータスラインが動かない。その場合は
`__CLAUDE_DIR__` を `~/.claude` の絶対パス（`/` 区切り）に自分で置き換えること。

## rules

`paths` フロントマターで対象を絞ってあるので、一致するファイルを読んだ時だけ読み込まれる。

- `java-spring.md` — Java / Kotlin / Gradle / Maven / Spring Boot
- `dotnet.md` — C# / .NET
- `web.md` — TypeScript / JavaScript / Astro / Svelte / Vue
- `python.md` — Python / ruff / pytest
- `server-ops.md` — Dockerfile / compose / Terraform / Ansible / k8s / systemd / nginx / IIS / CI
- `markdown-ja.md` — 日本語ドキュメントの書式

## hooks

- `guard-bash.mjs` — 破壊的な Git 操作に加えて、サービス停止・再起動、デプロイ、インフラ適用、
  スキーマ変更、`WHERE` の無い `DELETE`/`UPDATE`、`curl`/`wget`、`scp`/`ssh`、
  鍵ファイルの `cat` を実行前に拒否する
- `format-on-edit.mjs` — `.cs` → `dotnet format`、prettier/eslint、`.py` → `ruff format`。
  **すべて「リポジトリに設定がある場合のみ」動く**
- `session-start.mjs` — ブランチ・未コミット変更・ビルドコマンドを自動収集。
  起動のたびに外部通信しない

## skills

- `/system-change <要求>` — 影響範囲を絞ってから実装し、契約・データ・運用まで検証する
- `/verify-change [対象]` — 現在の差分に必要な検証を選び、実行済み／未確認を分けて報告する

どちらも手動起動専用。通常セッションでは description も読み込まれないため、常時トークンを消費しない。

## 評価

`eval/` は、この会社用設定が開発タスクの結果に与える影響を比較する評価基盤。
静的チェックは `node eval/selfcheck.mjs --profile work`、評価手順は [`eval/README.md`](eval/README.md) を参照する。

### Java / Kotlin を自動整形しない理由

spotless も google-java-format も「1 ファイルだけを安定して整形する」手段が無く、
プロジェクト全体を整形して無関係な差分を大量に出す危険がある。
Java / Kotlin はコミット前に `./gradlew spotlessApply` を明示的に実行する運用にしている。

## 任意: LSP プラグイン

会社 PC でグローバルインストールが許されるなら、`settings.json` に追記すると
定義ジャンプと参照検索が grep より正確になる。

```json
"enabledPlugins": {
  "jdtls-lsp@claude-plugins-official": true,
  "kotlin-lsp@claude-plugins-official": true,
  "csharp-lsp@claude-plugins-official": true,
  "typescript-lsp@claude-plugins-official": true,
  "pyright-lsp@claude-plugins-official": true
}
```

各プラグインの README に言語サーバー本体のインストール方法が書いてある。
インストールできない場合、プラグインを有効にしていても LSP が起動しないだけでエラーにはならない。

## 注意

- 会社の規程で許可された Git ホストと公開範囲を使うこと
- 社内のホスト名・IP・顧客名・プロジェクトコード名を、このリポジトリに書かない。
  ドメイン許可リストに社内ドメインを足すときも、社外に出して問題ない範囲か判断すること
- 会社が managed settings を配布している場合、そちらが常に優先される。
  `/status` の `Setting sources` で確認できる
