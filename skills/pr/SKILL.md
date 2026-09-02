---
name: pr
description: 現在のブランチから日本語の Pull Request を作る。本文を組み立てて確認を取ってから gh pr create する。
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, PowerShell
---

# Pull Request を作る

現在のブランチの変更内容から PR の本文を組み立て、**確認を取ってから** `gh pr create` する。

## 手順

### 1. 前提を確認する

```bash
git status --porcelain
git rev-parse --abbrev-ref HEAD
gh pr view --json number,url,state
```

- 未コミットの変更が残っていたら、先にコミットするか一時退避するようユーザーに確認する
- 既に PR があるなら、新規作成せず「既存 PR がある」と伝えて、本文の更新が要るか聞く
- `main` / `master` に居る場合は、PR にできないので止める

### 2. 変更内容を読む

```bash
git log <ベースブランチ>..HEAD --pretty=format:'%h %s'
git diff <ベースブランチ>...HEAD --stat
git diff <ベースブランチ>...HEAD
```

ベースブランチはリポジトリのデフォルトブランチ (`gh repo view --json defaultBranchRef` で確認)。

コミットメッセージを並べただけの本文にしない。差分を実際に読んで、
「何のために」「何を変えたか」を自分の言葉で書く。

### 3. 本文を組み立てる

```markdown
## 概要
<この PR で何が変わるか。2〜4 文>

## 変更点
- <変更の要点を箇条書きで>

## 背景・理由
<なぜこの変更が必要か。自明なら省略してよい>

## 動作確認
- <実際に確認したこと。確認していないなら「未確認」と書く>

## 補足
<レビュアーに見てほしい点、判断を仰ぎたい点。無ければ節ごと省略>
```

タイトルは日本語 1 行。コミットメッセージと同じ流儀 (prefix なし)。

### 4. 提示して確認を取る

**組み立てた本文をそのまま画面に出して、ユーザーの承認を得る。** 承認が出るまで作成しない。

### 5. 作成する

```bash
gh pr create --title "<タイトル>" --body-file <一時ファイル>
```

本文は一時ファイル経由で渡す (改行が壊れないため)。一時ファイルはリポジトリ内に作らない。
未 push のブランチなら、push してよいか確認したうえで `gh pr create` に任せる。

作成後は PR の URL を報告する。

## 守ること

- 確認なしに PR を作らない
- ドラフトにするか聞かれたら `--draft` を付ける
- レビュアーやラベルは、指定されない限り付けない
- `gh pr merge` はこのスキルの範囲外。求められても行わない
