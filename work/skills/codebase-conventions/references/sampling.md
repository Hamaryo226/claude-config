# 明示的設定の確認とサンプリング

## 1. 明示的設定 (コードより先に読む)

存在するものだけ。**設定が強制している項目は、コードの多数決より優先する。**

| 種類 | 探すファイル |
| --- | --- |
| エディタ共通 | `.editorconfig` |
| Java | `checkstyle.xml`, `spotless` 設定 (`pom.xml` / `build.gradle` 内), `google-java-format`, `pmd.xml`, `spotbugs-exclude.xml` |
| .NET | `.editorconfig` の `dotnet_*` / `csharp_*`, `stylecop.json`, `*.ruleset`, `Directory.Build.props`, `<Nullable>`, `<TreatWarningsAsErrors>`, `<LangVersion>` |
| TS / JS | `eslint.config.*`, `.eslintrc*`, `.prettierrc*`, `biome.json`, `tsconfig.json` (`strict`, `noImplicitAny`, `exactOptionalPropertyTypes`) |
| Python | `pyproject.toml` (`[tool.ruff]` / `[tool.black]` / `[tool.mypy]`), `setup.cfg`, `.flake8` |
| ビルド / CI | `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile` — **lint / format / 型チェックが必須かどうか** |

読み取ること:

- 強制されている項目は何か (インデント、改行、import 順、命名、null 許容、警告のエラー扱い)
- **CI で必須になっているか**。必須なら「これを通らない変更は無意味」なので最優先
- フォーマッタの実行コマンド (`./gradlew spotlessApply`, `dotnet format`, `npm run lint:fix`)

```bash
ls -a | head -40
cat .editorconfig 2>/dev/null
ls .github/workflows 2>/dev/null
```

**設定で自動修正される項目は rules に書かない。** ツールが直すので書いても無駄にトークンを使う。
書くのは実行コマンドと、ツールでは直らない項目だけ。

## 2. サンプリング

巨大なプロジェクトの全ファイルは読まない。**構造を掴む → 数える → 代表を読む** の順。

### 2-1. 構造を掴む

```bash
git ls-files | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -40
```

- モジュール / パッケージ / namespace の分かれ方
- レイヤらしきディレクトリ名 (`controller` `service` `repository` `domain` `application` `infrastructure`)
- ファイル数の多い場所 = そのプロジェクトの主戦場

### 2-2. 数える (全数)

**分類の判定は grep で全件数える。** ここを読んで済ませると母数が出ない。
`rg` と `jq` は無い環境があるので、Grep ツールか `git grep` を使う。

```bash
git grep -c "<pattern>" -- "<glob>" | wc -l     # 該当ファイル数
git grep -h "<pattern>" -- "<glob>" | wc -l     # 該当行数
git ls-files "<glob>" | wc -l                   # 母数
```

分母を必ず取る。`42 件見つかった` は根拠にならない。`42/45` が根拠。

### 2-3. 代表ファイルを読む

数字では分からないもの (コメントの文体、メソッドの分割具合、AAA 構造) は実際に読む。
次を**すべて含める**ように選ぶ。最低でも 8〜12 ファイル。

- 複数モジュール (単一モジュールなら複数パッケージ)
- 複数レイヤ (Controller / Service / Repository / Entity / テスト を各 2 件以上)
- **最近変更されたコード** — 現在の流儀を最もよく表す
- テストコード

```bash
git log --since="6 months ago" --name-only --pretty=format: \
  | grep -v '^$' | sort | uniq -c | sort -rn | head -30
```

### 2-4. 新旧を比較する

パターンが割れているように見えたら、期間で切って数え直す。

```bash
git log --since="12 months ago" --name-only --pretty=format: | grep -v '^$' | sort -u > /tmp/recent.txt
```

「全体では 18 対 17 で拮抗しているが、直近 1 年で触られたファイルでは 15 対 2」
のような結果が出たら、**それは混在ではなく移行中**。移行の方向を報告する。

### 読まないもの

- `node_modules/`, `vendor/`, `target/`, `bin/`, `obj/`, `dist/`
- 生成コード (`*.g.cs`, `*_pb2.py`, OpenAPI generator の出力, EF Migrations の designer)。
  **ただし「生成コードがどこにあるか」は編集禁止領域として記録する**
- 秘匿情報を含むファイル (`application-prod*.yml`, `.env*`, `*.tfvars`)
