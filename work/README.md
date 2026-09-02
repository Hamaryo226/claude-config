# work — 会社 PC 用プロファイル

会社の PC の `~/.claude` に配置するためのテンプレート。**このリポジトリが置かれている個人 PC では動かない**
（個人用の設定はリポジトリのルートにあり、そちらが `~/.claude` として動いている）。

## 配置手順

会社 PC でこのリポジトリを取得し、`work/` の中身だけを `~/.claude` に展開する。

### Windows

```powershell
git clone --depth 1 https://github.com/Hamaryo226/claude-config.git $env:TEMP\claude-config
cd $env:TEMP\claude-config\work
.\install.ps1
```

まず引数なしで実行すると **dry-run**（何が配置され、何が退避されるかを表示するだけ）。
内容を確認してから適用する。

```powershell
.\install.ps1 -Apply
```

### Linux / macOS

```bash
git clone --depth 1 https://github.com/Hamaryo226/claude-config.git /tmp/claude-config
cd /tmp/claude-config/work && ./install.sh
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

## `__CLAUDE_DIR__` について

`settings.json` の `statusLine.command` とフックの `args` は `__CLAUDE_DIR__` というプレースホルダで
書いてある。**install スクリプトがこれを実際のパスに置き換える。**
手でコピーした場合は置換されないので、フックとステータスラインが動かない。その場合は
`__CLAUDE_DIR__` を `~/.claude` の絶対パス（`/` 区切り）に自分で置き換えること。

## 個人用との違い

| | 個人用 (リポジトリのルート) | 会社用 (`work/`) |
| --- | --- | --- |
| コミット規約 | 日本語・prefix なしで固定 | **リポジトリの `git log` から読み取って合わせる** |
| 対象言語の rules | .NET / Web / Markdown | + **Java・Spring Boot / Python / サーバー運用** |
| `curl` `wget` | 使える | **deny**（社内情報の外部送信を防ぐ） |
| `WebFetch` | 広め | **公式ドキュメントのみに限定** |
| 秘密情報の deny | `.env` `*.pem` `id_rsa` など | + **`*.key` `*.jks` `*.tfvars` `application-prod*` `~/.m2/settings.xml` など** |
| サーバー操作 | 制限なし | **`systemctl` 停止/再起動・`iisreset`・`terraform apply`・`kubectl apply/delete`・`DROP TABLE` などをフックで拒否** |
| 保護ブランチ | `main` / `master` | + `develop` / `release` |
| 更新チャネル | `latest` | `stable` |

## rules

`paths` フロントマターで対象を絞ってあるので、一致するファイルを読んだ時だけ読み込まれる。

- `java-spring.md` — Java / Kotlin / Gradle / Maven / Spring Boot
- `dotnet.md` — C# / .NET
- `web.md` — TypeScript / JavaScript / Astro / Svelte / Vue
- `python.md` — Python / ruff / pytest
- `server-ops.md` — Dockerfile / compose / Terraform / Ansible / k8s / systemd / nginx / IIS / CI
- `markdown-ja.md` — 日本語ドキュメントの書式

## hooks

- `guard-bash.mjs` — 個人用のルールに加えて、サービス停止・再起動、デプロイ、インフラ適用、
  スキーマ変更、`WHERE` の無い `DELETE`/`UPDATE`、`curl`/`wget`、`scp`/`ssh`、
  鍵ファイルの `cat` を実行前に拒否する
- `format-on-edit.mjs` — `.cs` → `dotnet format`、prettier/eslint、`.py` → `ruff format`。
  **すべて「リポジトリに設定がある場合のみ」動く**
- `session-start.mjs` — ブランチ・未コミット変更・直近コミット・ビルドコマンドを自動収集

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

- このリポジトリは**個人の GitHub アカウントの private リポジトリ**にある。
  会社の規程で設定ファイルの社外保管が禁じられていないか確認すること
- 社内のホスト名・IP・顧客名・プロジェクトコード名を、このリポジトリに書かない。
  ドメイン許可リストに社内ドメインを足すときも、社外に出して問題ない範囲か判断すること
- 会社が managed settings を配布している場合、そちらが常に優先される。
  `/status` の `Setting sources` で確認できる
