import { chunk } from "./chunk.js";

// 表示用。1 行あたりの列数は呼び出し側が決める。
export function toRows(items,cols){
  return chunk(items,cols).map(r=>r.join(" | "));
}

export function summarize( items , cols ) {
    const rows = toRows( items , cols )
    return `${rows.length} 行 / ${items.length} 件`
}
