import { test } from "node:test";
import assert from "node:assert/strict";
import { taxOf, withTax } from "../src/tax.js";

test("標準税率の税額", () => { assert.equal(taxOf(1.15), 12); });
test("軽減税率の税額", () => { assert.equal(taxOf(2.5, "reduced"), 20); });
test("税込み金額", () => { assert.equal(withTax(0.29), 32); });
