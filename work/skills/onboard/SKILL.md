---
name: onboard
description: 今いるリポジトリに CLAUDE.md と .claude/settings.json の雛形を作る。個人設定 (~/.claude) と噛み合う形で、そのリポジトリ固有のことだけを書く。
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, PowerShell, Edit, Write
---

# リポジトリを Claude Code 向けに整える

今いるリポジトリに、プロジェクト固有の `CLAUDE.md` と `.claude/settings.json` を用意する。

組み込みの `/init` との違いは、**`~/.claude` の個人設定に既に書いてあることを繰り返さない**こと。
個人設定には応答言語、Windows 環境、git 運用、コミット規約、.NET と Web の規約が入っている。
ここに書くのは、そのリポジトリを見ないと分からないことだけ。

## 手順

### 1. 既存を確認する

```bash
ls -a
cat CLAUDE.md AGENTS.md .claude/CLAUDE.md 2>/dev/null
cat .claude/settings.json 2>/dev/null
```

- 既に `CLAUDE.md` があるなら**上書きしない**。不足している項目を足す提案をする
- `AGENTS.md` があって `CLAUDE.md` が無いなら、`@AGENTS.md` を 1 行目に書いた `CLAUDE.md` を作り、
  Claude Code 固有の追記だけを下に足す (Windows ではシンボリックリンクは避ける)

### 2. リポジトリを調べる

実際に読んで確かめる。推測で書かない。

- ビルド / テスト / 起動のコマンド — `package.json` の scripts、`.sln`、`Makefile`、`.github/workflows/`
- ディレクトリ構成のうち、名前から用途が読めないもの
- 使っているフレームワークとそのバージョン、対応ランタイム
- 独自の約束事 — 命名規則、レイヤ分け、生成コード、触ってはいけないファイル
- テストの置き場所と走らせ方
- CI で何がチェックされるか (ここを通らない変更は無意味なので最重要)

### 3. CLAUDE.md を書く

**120 行以内。** 長くなるなら `.claude/rules/` に path スコープで逃がす。

```markdown
# <リポジトリ名>

<1〜3 文で、これが何のプロジェクトか>

## コマンド
- ビルド: `...`
- テスト: `...`
- 起動: `...`
- CI で走るチェック: `...`

## 構成
- `src/...` — <用途>
- (名前から読めるディレクトリは書かない)

## このリポジトリの約束
- <規約。「なぜ」も添える>

## 触らないもの
- <生成物、外部から同期されるファイル、手で直すと壊れるもの>

## 落とし穴
- <過去にハマった箇所。Claude が同じ間違いを繰り返さないための情報>
```

書かないこと:

- コードを読めば分かること (ディレクトリ一覧、依存一覧、アーキテクチャの概説)
- 個人設定に既にあること (日本語で答える、コミット規約、Windows 環境、パス区切り)
- 一般的なプログラミングの心得

### 4. .claude/settings.json を書く

要るときだけ作る。何も足すことがないなら作らない。

入れる価値があるもの:

- `permissions.allow` — このリポジトリでよく使う、安全なコマンド (`Bash(npm run dev:*)` など)
- `permissions.deny` — このリポジトリ固有の読ませたくないパス
- `hooks` — リポジトリ固有のセットアップ (Claude Code on the web 用の SessionStart など)

git 管理下に置くファイルなので、個人の好み (テーマ、モデル) は入れない。

### 5. 提示する

作成・変更したファイルの内容をそのまま出して、ユーザーに確認してもらう。
コミットはしない (必要なら `/commit` を使ってもらう)。

## 守ること

- 既存の `CLAUDE.md` を勝手に書き換えない。差分を提案する
- 確かめていないコマンドを「これで動く」と書かない。実際に走らせて確認するか、未確認と明記する
- `.claude/settings.local.json` は個人用なので、このスキルでは作らない
