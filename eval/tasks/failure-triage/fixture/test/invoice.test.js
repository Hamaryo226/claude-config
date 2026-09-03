import { test } from "node:test";
import assert from "node:assert/strict";
import { subtotal, total, dueDate } from "../src/invoice.js";

test("明細の小計", () => {
  assert.equal(subtotal([{ unitPrice: 0.29, quantity: 3 }]), 87);
});
test("税込みの総額", () => {
  assert.equal(total([{ unitPrice: 0.29, quantity: 3 }]), 96);
});
test("単価が整数なら小計はずれない", () => {
  assert.equal(subtotal([{ unitPrice: 100, quantity: 2 }]), 20000);
});
test("月をまたがない支払期限", () => { assert.equal(dueDate("2024-03-01", 10), "2024-03-11"); });
test("月をまたぐ支払期限", () => { assert.equal(dueDate("2024-03-25", 10), "2024-04-04"); });
