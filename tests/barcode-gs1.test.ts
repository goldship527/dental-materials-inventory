import assert from "node:assert/strict";
import { calculateGtin14CheckDigit, isValidGtin14 } from "../src/lib/barcode/ean13";
import { analyzeBarcodeInput } from "../src/lib/barcode/gs1";
import { searchProductsByBarcode } from "../src/lib/db/barcodes";

const jan13 = "4900000000009";
const gtin14 = `0${jan13}`;
const sampleJan13 = "4900000123456";

{
  const result = analyzeBarcodeInput(`(01)${gtin14}(17)270531(10)LOT123`);

  assert.equal(result.extractedGtin, gtin14);
  assert.equal(result.extractedJan13, jan13);
  assert.equal(result.extractedBarcode, jan13);
  assert.equal(result.expiryDateText, "270531");
  assert.equal(result.expiryDate?.getFullYear(), 2027);
  assert.equal(result.expiryDate?.getMonth(), 4);
  assert.equal(result.expiryDate?.getDate(), 31);
  assert.equal(result.lotNumber, "LOT123");
  assert.equal(result.serialNumber, null);
  assert.deepEqual(result.searchValues, [`(01)${gtin14}(17)270531(10)LOT123`, gtin14, jan13]);
  assert.equal(result.preferredAttachBarcode, jan13);
}

{
  const result = analyzeBarcodeInput(`]C101${gtin14}1727053110LOT123`);

  assert.equal(result.extractedGtin, gtin14);
  assert.equal(result.extractedJan13, jan13);
  assert.ok(result.searchValues.includes(gtin14));
  assert.ok(result.searchValues.includes(jan13));
}

{
  const result = analyzeBarcodeInput(`(01)${gtin14}(17)270531(10)LOT123(21)SER01`);

  assert.equal(result.extractedGtin, gtin14);
  assert.equal(result.extractedJan13, jan13);
  assert.equal(result.expiryDateText, "270531");
  assert.equal(result.expiryDate?.getFullYear(), 2027);
  assert.equal(result.expiryDate?.getMonth(), 4);
  assert.equal(result.expiryDate?.getDate(), 31);
  assert.equal(result.lotNumber, "LOT123");
  assert.equal(result.serialNumber, "SER01");
}

{
  const result = analyzeBarcodeInput(`]C101${gtin14}1727053110LOT123\u001d21SER01`);

  assert.equal(result.extractedGtin, gtin14);
  assert.equal(result.extractedJan13, jan13);
  assert.equal(result.expiryDateText, "270531");
  assert.equal(result.expiryDate?.getFullYear(), 2027);
  assert.equal(result.expiryDate?.getMonth(), 4);
  assert.equal(result.expiryDate?.getDate(), 31);
  assert.equal(result.lotNumber, "LOT123");
  assert.equal(result.serialNumber, "SER01");
}

{
  const result = analyzeBarcodeInput(`]C101${gtin14}10LOT12321SER01`);

  assert.equal(result.lotNumber, "LOT123");
  assert.equal(result.serialNumber, "SER01");
}

{
  const result = analyzeBarcodeInput(`(01)${gtin14}(17)270500`);

  assert.equal(result.expiryDateText, "270500");
  assert.equal(result.expiryDate?.getFullYear(), 2027);
  assert.equal(result.expiryDate?.getMonth(), 4);
  assert.equal(result.expiryDate?.getDate(), 31);
}

{
  const invalidMonth = analyzeBarcodeInput(`(01)${gtin14}(17)270000`);

  assert.equal(invalidMonth.expiryDateText, "270000");
  assert.equal(invalidMonth.expiryDate, null);

  const invalidDay = analyzeBarcodeInput(`(01)${gtin14}(17)270532`);

  assert.equal(invalidDay.expiryDateText, "270532");
  assert.equal(invalidDay.expiryDate, null);
}

{
  const result = analyzeBarcodeInput(gtin14);

  assert.equal(result.extractedGtin, gtin14);
  assert.equal(result.extractedJan13, jan13);
  assert.deepEqual(result.searchValues, [gtin14, jan13]);
}

{
  const result = analyzeBarcodeInput(jan13);

  assert.equal(result.extractedGtin, null);
  assert.equal(result.extractedJan13, jan13);
  assert.equal(result.extractedBarcode, jan13);
  assert.deepEqual(result.searchValues, [jan13]);
  assert.equal(result.preferredAttachBarcode, jan13);
}

{
  assert.equal(calculateGtin14CheckDigit(gtin14.slice(0, 13)), gtin14[13]);
  assert.equal(isValidGtin14(gtin14), true);
  assert.equal(isValidGtin14(`${gtin14.slice(0, 13)}0`), false);
}

{
  // GS1アルゴリズム検証用の架空値。実在製品との対応を前提にしない。
  assert.equal(calculateGtin14CheckDigit("0001234567890"), "5");
  assert.equal(isValidGtin14("00012345678905"), true);
  assert.equal(isValidGtin14("00012345678901"), false);
  assert.equal(calculateGtin14CheckDigit("1234567890123"), "1");
  assert.equal(isValidGtin14("12345678901231"), true);
  assert.equal(isValidGtin14("12345678901235"), false);
}

{
  const result = analyzeBarcodeInput("(01)00012345678905");

  assert.equal(result.extractedGtin, "00012345678905");
  assert.equal(result.extractedJan13, "0012345678905");
  assert.equal(result.extractedBarcode, "0012345678905");
  assert.ok(result.searchValues.includes("00012345678905"));
  assert.ok(result.searchValues.includes("0012345678905"));
}

{
  const invalidGtin14 = `${gtin14.slice(0, 13)}0`;
  const result = analyzeBarcodeInput(invalidGtin14);

  assert.equal(result.extractedGtin, null);
  assert.equal(result.searchValues.includes(gtin14), false);
}

{
  const result = analyzeBarcodeInput("(01)00012345678901");

  assert.equal(result.extractedGtin, null);
  assert.equal(result.searchValues.includes("00012345678901"), false);
}

async function runAsyncTests() {
  const longInputResult = await searchProductsByBarcode("clinic-id", "1".repeat(301));

  assert.deepEqual(longInputResult, []);
}

{
  const result = analyzeBarcodeInput("---");

  assert.deepEqual(result.searchValues, []);
}

void runAsyncTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
