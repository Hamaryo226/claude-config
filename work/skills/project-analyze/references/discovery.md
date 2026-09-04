# Phase 1 — 調査項目

埋まらない項目は「未確認」と書いて残す。推測で埋めない。
各項目には**根拠にしたファイルのパス**を必ず添える。

## 1. 資料の在庫を取る

コードより先に、何が書かれているかを把握する。

```bash
ls -a
find . -maxdepth 3 -iname "*.md" -not -path "./node_modules/*" -not -path "./.git/*"
find . -maxdepth 4 -iname "docs" -o -iname "doc" -o -iname "設計*" -o -iname "仕様*" -o -iname "adr" -type d
```

探すもの (ある分だけ):

| 種類 | 典型的な場所 |
| --- | --- |
| README / AGENTS.md / 既存 CLAUDE.md | ルート |
| 基本設計書 / 詳細設計書 / DB 設計書 | `docs/`, `設計/`, 共有ドライブへのリンク |
| 画面仕様 / バッチ仕様 / 運用手順 | `docs/`, `operations/`, `batch/` |
| API 仕様 | `openapi.yaml`, `swagger.json`, `*.http`, `docs/api/` |
| ADR | `docs/adr/`, `docs/decisions/` |
| DB migration / schema | `db/migration/`, `migrations/`, `*.sql`, Flyway / Liquibase / EF Migrations |

**バイナリ形式 (`.xlsx` / `.docx` / `.pdf` / `.vsdx` など) は開けない。**
パスと更新日時だけ記録し、「存在するが未解析」として報告する。中身を推測しない。
ユーザーが要点を貼ってくれるなら、それを一次資料として扱う。

## 2. 技術とバージョン

宣言ファイルから読む。コードからの推測はしない。

- `package.json` + ロックファイル / `pom.xml` / `build.gradle(.kts)` / `*.sln` / `*.csproj`
- `pyproject.toml` / `requirements.txt` / `Cargo.toml` / `go.mod`
- `.nvmrc` / `.java-version` / `global.json` / `.tool-versions` / `Dockerfile` の base image
- フレームワークのメジャーバージョン (Spring Boot 2 と 3、.NET Framework と .NET 8 は別物として扱う)

## 3. build / test / run と CI

**CI で走るものが唯一の正解。** ローカルの手順書と食い違ったら CI を優先する。

```bash
ls .github/workflows .gitlab-ci.yml Jenkinsfile azure-pipelines.yml 2>/dev/null
```

- ビルドコマンド (ラッパーの有無: `./gradlew` / `./mvnw` / `dotnet` / パッケージマネージャ)
- テストコマンドと、**一部だけ流す構文** (`--tests`, `--filter`, `-k`, `-t`)
- CI で必須のチェック — lint / format / 型 / カバレッジ閾値 / セキュリティスキャン
- ここを通らない変更は無意味なので、CLAUDE.md に書く価値が最も高い

## 4. 構造とアーキテクチャ

- 名前から用途が読めないディレクトリだけを控える (`src/` `test/` は書かない)
- モジュール構成とその依存方向。マルチモジュール構成なら親の定義ファイルから読む
- レイヤ間の禁止事項 (例: domain から infra を参照しない) — **設計資料か CI の依存チェックで裏を取る**。
  コードがそう見えるというだけでは書かない
- 設計資料に書かれたアーキテクチャと、実装のディレクトリ構成の一致／不一致

## 5. 規約

そのリポジトリを見ないと分からないものだけ。言語一般の命名規則は書かない。

- コーディング規約 — フォーマッタ・リンタの設定ファイル (`.editorconfig`, `.eslintrc`, `checkstyle.xml`,
  `.ruff.toml`, `.clang-format`)。**設定ファイルがあるなら規約は文章にせず、コマンドを書く**
- DB 規約 — テーブル／カラムの命名、論理削除の扱い、マイグレーションの採番と適用手順
- テスト規約 — 置き場所、命名、モックの方針、DB を使うテストの前提条件

## 6. 触ってはいけないもの

- 生成コード (OpenAPI generator, EF Migrations の designer, protobuf, `*.g.cs`, `*_pb2.py`)。
  再生成コマンドとセットで控える
- 外部から同期されるファイル、ベンダーディレクトリ
- 秘匿情報を含むファイル (`application-prod*.yml`, `*.tfvars`, `appsettings.Production.json`,
  `.env*`)。**中身は読まない。** deny の候補として控える

## 7. プロジェクト固有のワークフロー

`git log` と CI から、繰り返し発生している複数ステップ作業を探す。

```bash
git log --oneline -50
git log --name-only --pretty=format: -100 | sort | uniq -c | sort -rn | head -30
```

- 一緒に変更されるファイル群 (例: エンティティ + migration + テストデータが毎回セット)
- ブランチ運用・リリース手順 (タグの付け方、リリースノート、承認フロー)
- 「これを変えたら必ずあれも直す」という暗黙の手順

これが Skill 候補になる。**1〜2 回しか出てこない作業は Skill にしない。**

## 8. 設計書と実装の不一致

見つけたものを列挙する。片方を正解と決めない。

- 設計書にあるテーブル・カラム・API が実装に無い / 逆
- 設計書の手順と CI の手順が違う
- 設計書の更新日が実装より明らかに古い

判断できないものは、そのまま「矛盾」として報告する。
