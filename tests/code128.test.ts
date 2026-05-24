import assert from "node:assert/strict";
import { encodeCode128B, getCode128Bars, isValidCode128BValue } from "../src/lib/barcode/code128";

assert.equal(isValidCode128BValue("STAFF-0001"), true);
assert.equal(isValidCode128BValue("staff_001"), true);
assert.equal(isValidCode128BValue(""), false);
assert.equal(isValidCode128BValue("担当者"), false);

const encoded = encodeCode128B("STAFF-0001");
assert.equal(typeof encoded, "string");
assert.equal(encoded?.startsWith("11010010000"), true);
assert.equal(encoded?.endsWith("1100011101011"), true);

const bars = getCode128Bars("STAFF-0001");
assert.equal(bars.length > 0, true);
assert.equal(bars[0].x, 0);
assert.equal(getCode128Bars("担当者").length, 0);
