# 生成物のテンプレートと分量の上限

テンプレートは**枠**であって、埋めるべきノルマではない。
書くことが無い節は**節ごと消す**。空見出しを残さない。

| ファイル | 上限 | 超えたときの対処 |
| --- | --- | --- |
| `CLAUDE.md` | 120 行 | rules に逃がす前に、まず削る |
| `.claude/rules/*.md` | 各 60 行 | ルールを絞る。ファイルを増やさない |
| `.claude/skills/*/SKILL.md` | 各 100 行 | 詳細を `references/` に分けて `@` で参照する |
| `.claude/agents/*.md` | 各 40 行 | description の絞り込みを優先する |

## CLAUDE.md

```markdown
# <システム名>

<1〜3 文。何をするシステムか。誰が使うか>

## コマンド

- ビルド: `...`
- テスト: `...`  (一部だけ: `...`)
- 起動: `...`
- CI で必須: `...`   ← 通らない変更は無意味。最優先で書く

## 構成

- `<dir>/` — <名前から読めないものだけ>

## 制約

- <破ると動かない／必ず差し戻される、このシステム固有の決まり。「なぜ」も添える>

## 触らないもの

- `<path>` — <生成物か外部同期か>。再生成: `<コマンド>`

## 未確認 / 未解析

- <実行して確かめられなかったコマンド>
- <読めなかったバイナリ設計書のパス>
```

`未確認 / 未解析` の節は、該当が無ければ消す。**あるのに書かない方が有害。**

## .claude/rules/<name>.md

```markdown
---
paths:
  - "<glob>"
---

# <対象の名前>

<そのファイル種別を触るときだけ必要な、このリポジトリ固有のこと>
```

`paths` が書けないものは rules にしない (Phase 2 に戻して、CLAUDE.md か「作らない」を選び直す)。

## .claude/skills/<name>/SKILL.md

```markdown
---
name: <name>
description: <いつ使うか。作業の名前だけでなく、起動すべき状況を書く>
allowed-tools: <必要なものだけ>
---

# <作業名>

## 前提

<この手順が要る条件。要らない場合の判断>

## 手順

### 1. ...
### 2. ...

## 守ること

- <順序を間違えると壊れる点>
```

`disable-model-invocation: true` は、リモート／公開状態を書き換える手順にだけ付ける。

## .claude/agents/<name>.md

```markdown
---
name: <name>
description: <いつ呼ぶか + **規模の条件**。「小さいものは直接調べた方が速い」を明示する>
tools: <必要なものだけ>
---

<役割。何を返すか。何をしないか (例: コードは直さない)>
```

## .claude/settings.json

必要な節だけ書く。空の節を残さない。

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "deny": ["Read(//**/application-prod*.yml)"],
    "allow": ["Bash(./gradlew test:*)"]
  }
}
```
