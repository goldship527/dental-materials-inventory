import assert from "node:assert/strict";
import { calculateEan13CheckDigit, encodeEan13, getEan13Bars, isValidEan13 } from "../src/lib/barcode/ean13";

assert.equal(calculateEan13CheckDigit("490123456789"), "4");
assert.equal(isValidEan13("4901234567894"), true);
assert.equal(isValidEan13("4901234567895"), false);

const encoded = encodeEan13("4901234567894");
assert.equal(encoded?.length, 95);
assert.equal(encoded?.startsWith("101"), true);
assert.equal(encoded?.slice(45, 50), "01010");
assert.equal(encoded?.endsWith("101"), true);

const bars = getEan13Bars("4901234567894");
assert.ok(bars.length > 0);
assert.ok(bars.some((bar) => bar.isGuard));
