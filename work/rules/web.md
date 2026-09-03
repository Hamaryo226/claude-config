---
paths:
  - "**/*.{ts,tsx,mts,cts}"
  - "**/*.{js,jsx,mjs,cjs}"
  - "**/*.{astro,svelte,vue}"
  - "**/package.json"
  - "**/tsconfig*.json"
---

# TypeScript / Web

<!-- 一般的な良し悪し (any を足さない、as を避ける、型を明示する等) は書かない。
     Sonnet 5 は指示しなくてもやる。ここはリポジトリを見ないと分からないことだけ。 -->

## パッケージマネージャ

ロックファイルで判定する。**混ぜると壊れる。**

| ロックファイル | 使うコマンド |
| --- | --- |
| `pnpm-lock.yaml` | `pnpm` |
| `bun.lock` / `bun.lockb` | `bun` |
| `yarn.lock` | `yarn` |
| `package-lock.json` | `npm` |

`package.json` の `packageManager` フィールドがあればそれが最優先。
`package.json` を手書きで書き換えて依存を足さない。必ず該当のパッケージマネージャで入れる。

## 検証コマンド

- 型チェック: `npx --no-install tsc --noEmit` (または `package.json` の該当 script)
- `--no-install` を付ける。設定はあるが未インストールのリポジトリで勝手に落としてこない

## 整形

- prettier 設定があれば編集後に `prettier --write` が自動で走る (PostToolUse フック)
- prettier が無く ESLint が入っていれば `eslint --fix` が走る
- **どちらも無いリポジトリでは何も走らない。その場合は既存ファイルの見た目に手で合わせる**

## フレームワーク

- Next.js / Astro などは、そのリポジトリのバージョンの流儀に従う
  (App Router か Pages Router か、Server Component かどうかを先に確認する)
- `npm run dev` のような開発サーバを、確認のために勝手に起動したままにしない
