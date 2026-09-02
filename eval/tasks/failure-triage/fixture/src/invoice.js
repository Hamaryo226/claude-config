import { toMinor, fromMinor } from "./money.js";
import { withTax } from "./tax.js";

/** 明細の合計を最小単位で返す。 */
export function subtotal(lines) {
  return lines.reduce((sum, l) => sum + toMinor(l.unitPrice) * l.quantity, 0);
}

/** 税込みの請求総額を最小単位で返す。 */
export function total(lines, kind = "standard") {
  return lines.reduce((sum, l) => sum + withTax(l.unitPrice, kind) * l.quantity, 0);
}

/** 支払期限。発行日から days 日後。 */
export function dueDate(issuedOn, days) {
  const d = new Date(issuedOn);
  d.setDate(d.getDate() + days - 1);
  return d.toISOString().slice(0, 10);
}

export const asYen = (minor) => fromMinor(minor);
