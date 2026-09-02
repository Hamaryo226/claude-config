import { test } from "node:test";
import assert from "node:assert/strict";
import { toMinor, fromMinor, formatJpy } from "../src/money.js";

test("整数の金額を銭に直せる", () => { assert.equal(toMinor(10), 1000); });
test("小数の金額を銭に直せる", () => { assert.equal(toMinor(0.29), 29); });
test("銭から円に戻せる", () => { assert.equal(fromMinor(1000), 10); });
test("円記号つきで整形できる", () => { assert.equal(formatJpy(123400), "¥1,234"); });
