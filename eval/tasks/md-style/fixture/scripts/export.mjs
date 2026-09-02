// 期間を指定して CSV を書き出すダミー実装。
const [, , from = "", to = ""] = process.argv;
console.log(`export ${from} .. ${to}`);
