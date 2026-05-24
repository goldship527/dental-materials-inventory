import assert from "node:assert/strict";
import { normalizeBarcodeText } from "../src/lib/barcode/normalize";
import { analyzeBarcodeInput } from "../src/lib/barcode/gs1";
import { normalizeStaffOperatorBarcode } from "../src/lib/db/staff-operators";

assert.equal(normalizeBarcodeText("４９００００００００００９"), "4900000000009");
assert.equal(normalizeBarcodeText("ＳＴＡＦＦ－０００１"), "STAFF-0001");
assert.equal(normalizeBarcodeText("　STAFF−0001　"), "STAFF-0001");

const productAnalysis = analyzeBarcodeInput("４９００００００００００９");
assert.equal(productAnalysis.rawInput, "4900000000009");
assert.equal(productAnalysis.normalizedInput, "4900000000009");
assert.equal(productAnalysis.extractedJan13, "4900000000009");
assert.deepEqual(productAnalysis.searchValues, ["4900000000009"]);

assert.equal(normalizeStaffOperatorBarcode("ｓｔａｆｆ－０００１"), "STAFF-0001");
