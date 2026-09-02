// 実データの代わりに、期間と形式から決まる文字列を返すダミー。
export function collect({ since, until, format }) {
  const rows = [["date", "count"], [since, "1"], [until, "2"]];
  if (format === "json") return JSON.stringify(rows.slice(1).map(([date, count]) => ({ date, count }))) + "\n";
  return rows.map((r) => r.join(",")).join("\n") + "\n";
}
