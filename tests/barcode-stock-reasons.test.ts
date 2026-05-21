import assert from "node:assert/strict";
import {
  barcodeStockInReasons,
  barcodeStockOutReasons,
  isAllowedBarcodeStockReason,
} from "../src/lib/barcode/stock-reasons";

async function main() {
  assert.deepEqual(barcodeStockOutReasons, ["使用", "その他"]);
  assert.deepEqual(barcodeStockInReasons, ["納品", "返品戻り", "その他"]);

  assert.equal(barcodeStockOutReasons.includes("棚卸調整"), false);
  assert.equal(barcodeStockInReasons.includes("棚卸調整"), false);

  assert.equal(isAllowedBarcodeStockReason("OUT", "使用"), true);
  assert.equal(isAllowedBarcodeStockReason("OUT", "棚卸調整"), false);
  assert.equal(isAllowedBarcodeStockReason("IN", "納品"), true);
  assert.equal(isAllowedBarcodeStockReason("IN", "棚卸調整"), false);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
