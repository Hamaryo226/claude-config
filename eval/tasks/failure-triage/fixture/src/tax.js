import { toMinor } from "./money.js";

export const RATES = { standard: 0.1, reduced: 0.08 };

/** 税抜き金額から税額を最小単位で返す。 */
export function taxOf(amount, kind = "standard") {
  return toMinor(amount * RATES[kind]);
}

/** 税込み金額を最小単位で返す。 */
export function withTax(amount, kind = "standard") {
  return toMinor(amount) + taxOf(amount, kind);
}
