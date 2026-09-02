---
paths:
  - "**/*.{ts,tsx,mts,cts}"
  - "**/*.{js,jsx,mjs,cjs}"
  - "**/*.{astro,svelte,vue}"
  - "**/package.json"
  - "**/tsconfig*.json"
---

# TypeScript / Web

## パッケージマネージャ

ロックファイルで判定する。混ぜると壊れる。

| ロックファイル | 使うコマンド |
| --- | --- |
| `pnpm-lock.yaml` | `pnpm` |
| `bun.lock` / `bun.lockb` | `bun` |
| `yarn.lock` | `yarn` |
| `package-lock.json` | `npm` |

- `package.json` の `packageManager` フィールドがあればそれが最優先
- 依存を足すときは必ず該当のパッケージマネージャで入れる。`package.json` の手書き追記はしない

## TypeScript

- `any` を足さない。型が分からないときは `unknown` にして絞り込む
- `as` によるキャストは最後の手段。型ガードか型定義の修正で解けないか先に考える
- `@ts-ignore` / `@ts-expect-error` を付けるなら、理由を同じ行のコメントに書く
- 型チェックは `npx --no-install tsc --noEmit` (または `package.json` の該当 script) で確認する
- 公開 API になる関数は引数と戻り値の型を明示する。内部関数の推論は任せてよい

## 整形とリント

- prettier 設定があるリポジトリでは、編集後に自動で `prettier --write` が走る
- prettier が無く ESLint が入っているリポジトリでは `eslint --fix` が走る
- どちらも無いリポジトリでは何も走らない。**その場合は既存ファイルの見た目に手で合わせる**
- 整形のためだけの差分を、機能の変更と同じコミットに混ぜない

## フレームワーク

- Next.js / Astro などは、そのリポジトリのバージョンの流儀に従う
  (App Router か Pages Router か、Server Component かどうかを先に確認する)
- `npm run dev` のような開発サーバを、確認のために勝手に起動したままにしない
- 環境変数は `.env` を読まずに扱う (読み取りは設定でブロックしてある)。
  値が必要なら何が必要かを伝えて渡してもらう
