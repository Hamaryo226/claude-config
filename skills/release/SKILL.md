---
name: release
description: バージョンを上げて RELEASE_NOTES を更新し、タグを打つまでの手順を進める。タグ push とリリース公開は必ず確認を取る。
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, PowerShell, Edit, Write
---

# リリースを準備する

バージョン更新 → リリースノート追記 → コミット → タグ、までを進める。
**push と公開は必ず確認を取ってから。**

## 手順

### 1. 現況を確認する

```bash
git status --porcelain
git rev-parse --abbrev-ref HEAD
git describe --tags --abbrev=0 2>/dev/null
git tag --sort=-v:refname | head -5
```

- 未コミットの変更が残っていたら、先に片付けるようユーザーに確認する
- 直近タグの命名形式 (`v1.2.3` か `1.2.3` か) を必ず既存タグから確認して踏襲する

### 2. 変更内容を集める

```bash
git log <直近タグ>..HEAD --pretty=format:'%h %s'
```

コミットメッセージをそのまま並べない。読んで、ユーザー視点で「何が変わったか」に翻訳する。
内部リファクタリングだけのコミットは、まとめるか省く。

### 3. バージョンを決める

変更内容から semver で提案し、**ユーザーに確認を取る**。

- 破壊的変更あり → major
- 機能追加 → minor
- 修正のみ → patch

### 4. バージョンを書き換える

リポジトリの形式に合わせて、該当箇所を全て更新する。書き換えたら漏れがないか grep で確認する。

- .NET: `.csproj` の `<Version>` / `<AssemblyVersion>` / `<FileVersion>`、`Properties/AssemblyInfo.cs`
- Node: `package.json` の `version` (ロックファイルの `version` も合わせる)
- Python: `pyproject.toml` の `version`、`__init__.py` の `__version__`

```bash
git grep -n "<旧バージョン>"
```

### 5. RELEASE_NOTES を更新する

既存の `RELEASE_NOTES.md` / `CHANGELOG.md` があれば、その書式に完全に合わせる。
無ければ作らずに、要るかユーザーに聞く。

日本語で書く。`~/.claude/rules/markdown-ja.md` の規約に従う。

```markdown
## vX.Y.Z (YYYY-MM-DD)

### 追加
- <ユーザーから見て何ができるようになったか>

### 修正
- <何が直ったか>

### 変更
- <挙動が変わったもの。破壊的変更はここで明示する>
```

該当のない節は書かない。

### 6. コミットする

バージョン更新とリリースノートは 1 コミットにまとめる。

```bash
git add <書き換えたファイル>
git commit -m "vX.Y.Z"
```

メッセージはそのリポジトリの過去のリリースコミットに合わせる。

### 7. タグを打つ

```bash
git tag vX.Y.Z
```

**ここまでがこのスキルの自動で進める範囲。** 以降は手順を提示して、実行はユーザーに任せる:

```bash
git push origin <ブランチ>
git push origin vX.Y.Z
gh release create vX.Y.Z --notes-file <ファイル>
```

## 守ること

- push とリリース公開を自動で実行しない。コマンドを提示して確認を取る
- バージョン番号をユーザーの確認なしに決めない
- 既存のタグ名・ノートの書式を変えない
- ビルドが通ることを確認してからタグを打つ。確認していないならその旨を伝える
