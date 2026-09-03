# csv-export

期間を指定してレコードを CSV か JSON で書き出す CLI。

## 使い方

インストールせずに実行する。

```bash
node src/cli.mjs --since 2024-01-01
```

テストは次のコマンドで走る。

```bash
npm run check
```

## 構成

- `src/cli.mjs` — 引数の解釈と入出力
- `src/collect.mjs` — 書き出す中身の組み立て
