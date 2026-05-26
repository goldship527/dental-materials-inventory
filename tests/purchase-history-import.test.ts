import assert from "node:assert/strict";
import { buildPurchaseHistoryImportPreview, type PurchaseHistoryExistingProduct } from "../src/lib/imports/purchase-history-import";

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function buildCsv(rows: string[][]) {
  return [
    "purchaseDate,dealerName,dealerProductCode,supplierProductCode,janCode,productName,manufacturer,specification,quantity,unitPrice,amount",
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
}

const existingProducts: PurchaseHistoryExistingProduct[] = [
  {
    id: "product-jan",
    name: "Existing Bond",
    janCode: "4900000000001",
    manufacturer: "Sample Maker",
  },
  {
    id: "product-barcode",
    name: "Existing Tips",
    manufacturer: "Sample Supply",
    barcodes: ["4900000000002"],
  },
  {
    id: "product-supplier-code",
    name: "Existing Paste",
    manufacturer: "Sample Maker",
    supplierProductCodes: ["SUP-EXISTING"],
  },
  {
    id: "product-dealer-code",
    name: "Existing Gloves",
    manufacturer: "Sample Supply",
    productCode: "DLR-EXISTING",
  },
  {
    id: "product-name-exact",
    name: "Sample Cement",
    manufacturer: "Sample Maker",
  },
  {
    id: "product-similar-a",
    name: "Flow Composite A1",
    manufacturer: "Sample Maker",
  },
  {
    id: "product-similar-b",
    name: "Flow Composite A2",
    manufacturer: "Sample Maker",
  },
];

async function main() {
  const preview = buildPurchaseHistoryImportPreview({
    sourceType: "CSV",
    existingProducts,
    text: buildCsv([
      ["2026-05-01", "Sample Dealer", "DLR-001", "SUP-001", "4900000000001", "Existing Bond", "Sample Maker", "5ml", "2", "1200", "2400"],
      ["2026-05-02", "Sample Dealer", "DLR-002", "SUP-002", "4900000000002", "Existing Tips", "Sample Supply", "100 pieces", "1", "800", "800"],
      ["2026-05-03", "Sample Dealer", "DLR-003", "SUP-EXISTING", "", "Existing Paste", "Sample Maker", "tube", "3", "900", "2700"],
      ["2026-05-04", "Sample Dealer", "DLR-EXISTING", "", "", "Existing Gloves", "Sample Supply", "box", "4", "700", "2800"],
      ["2026-05-05", "Sample Dealer", "DLR-005", "SUP-005", "", "Sample Cement", "Sample Maker", "set", "1", "2000", "2000"],
      ["2026-05-06", "Sample Dealer", "DLR-006", "SUP-006", "", "New Impression Material", "Sample Maker", "regular", "2", "2500", "5000"],
      ["2026-05-07", "Sample Dealer", "DLR-007", "SUP-007", "", "Flow Composite", "Sample Maker", "syringe", "1", "1500", "1500"],
      ["2026-05-08", "Sample Dealer", "DLR-008", "SUP-008", "4900000000999", "Duplicate New Item", "Sample Maker", "pack", "2", "500", "1000"],
      ["2026-05-15", "Sample Dealer", "DLR-009", "SUP-009", "4900000000999", "Duplicate New Item", "Sample Maker", "pack", "5", "500", "2500"],
      ["2026-05-16", "Sample Dealer", "", "", "", "Missing Codes", "Sample Maker", "pack", "1", "100", "100"],
    ]),
  });

  assert.equal(preview.summary.totalRows, 10);
  assert.equal(preview.summary.existingRows, 5);
  assert.equal(preview.summary.createRows, 3);
  assert.equal(preview.summary.needsReviewRows, 1);
  assert.equal(preview.summary.errorRows, 1);

  assert.equal(preview.rows[0]?.status, "EXISTING");
  assert.equal(preview.rows[0]?.matchReason, "JAN_EXACT");
  assert.equal(preview.rows[0]?.matchedProductId, "product-jan");
  assert.equal(preview.rows[1]?.matchReason, "BARCODE_EXACT");
  assert.equal(preview.rows[2]?.matchReason, "SUPPLIER_PRODUCT_CODE_EXACT");
  assert.equal(preview.rows[3]?.matchReason, "DEALER_PRODUCT_CODE_EXACT");
  assert.equal(preview.rows[4]?.matchReason, "MANUFACTURER_AND_NAME_EXACT");

  assert.equal(preview.rows[5]?.status, "CREATE");
  assert.equal(preview.rows[5]?.matchReason, "NO_MATCH");

  assert.equal(preview.rows[6]?.status, "NEEDS_REVIEW");
  assert.equal(preview.rows[6]?.matchReason, "NAME_SIMILAR");
  assert.deepEqual(preview.rows[6]?.candidateProductIds, ["product-similar-a", "product-similar-b"]);

  assert.equal(preview.rows[7]?.duplicateInFile, true);
  assert.equal(preview.rows[7]?.purchaseCountInFile, 2);
  assert.equal(preview.rows[7]?.totalQuantityInFile, 7);
  assert.equal(preview.rows[7]?.latestPurchaseDateInFile, "2026-05-15");
  assert.equal(preview.rows[8]?.duplicateInFile, true);

  assert.equal(preview.rows[9]?.status, "ERROR");
  assert.match(preview.rows[9]?.errors.join(" "), /JANコード、ディーラー商品コード、発注先品番のいずれかが必要です/);

  const invalidPreview = buildPurchaseHistoryImportPreview({
    sourceType: "CSV",
    existingProducts,
    text: buildCsv([
      ["2026-05-01", "Sample Dealer", "DLR-001", "SUP-001", "123", "Invalid JAN", "Sample Maker", "5ml", "abc", "-1", "bad"],
    ]),
  });

  assert.equal(invalidPreview.summary.errorRows, 1);
  assert.deepEqual(invalidPreview.rows[0]?.errors, [
    "購入数量は0以上の数値で入力してください。",
    "単価は0以上の数値で入力してください。",
    "金額は0以上の数値で入力してください。",
    "JANコードは8桁から14桁の数字で入力してください。",
  ]);

  const codeRequirementPreview = buildPurchaseHistoryImportPreview({
    sourceType: "CSV",
    existingProducts: [],
    text: buildCsv([
      ["2026-05-01", "Sample Dealer", "", "", "4900000000888", "JAN Only New Item", "Sample Maker", "pack", "1", "100", "100"],
      ["2026-05-02", "Sample Dealer", "DLR-ONLY", "", "", "Dealer Code Only New Item", "Sample Maker", "pack", "1", "100", "100"],
      ["2026-05-03", "Sample Dealer", "", "", "", "Missing All Codes", "Sample Maker", "pack", "1", "100", "100"],
    ]),
  });

  assert.equal(codeRequirementPreview.rows[0]?.status, "CREATE");
  assert.equal(codeRequirementPreview.rows[0]?.janCode, "4900000000888");
  assert.equal(codeRequirementPreview.rows[1]?.status, "CREATE");
  assert.equal(codeRequirementPreview.rows[1]?.dealerProductCode, "DLR-ONLY");
  assert.equal(codeRequirementPreview.rows[2]?.status, "ERROR");
  assert.match(codeRequirementPreview.rows[2]?.errors.join(" "), /JANコード、ディーラー商品コード、発注先品番のいずれかが必要です。/);

  const tsvPreview = buildPurchaseHistoryImportPreview({
    sourceType: "TSV",
    existingProducts: [],
    text: [
      "購入日\tディーラー名\tディーラー商品コード\t発注先品番\tjanコード\t商品名\tメーカー名\t規格\t購入数量\t単価\t金額",
      "2026-05-01\tSample Dealer\tDLR-TSV\t\t\tTSV Item\tSample Maker\tpack\t2\t100\t200",
    ].join("\n"),
  });

  assert.equal(tsvPreview.summary.createRows, 1);
  assert.equal(tsvPreview.rows[0]?.dealerProductCode, "DLR-TSV");
  assert.equal(tsvPreview.rows[0]?.productName, "TSV Item");

  const quotedCsvPreview = buildPurchaseHistoryImportPreview({
    sourceType: "CSV",
    existingProducts: [],
    text: buildCsv([
      [
        "2026-05-01",
        "Sample Dealer",
        "DLR-COMMA",
        "",
        "",
        'Quoted, "Escaped" Item',
        "Sample Maker",
        "pack",
        "1",
        "1,200",
        "1,200",
      ],
    ]),
  });

  assert.equal(quotedCsvPreview.rows[0]?.status, "CREATE");
  assert.equal(quotedCsvPreview.rows[0]?.productName, 'Quoted, "Escaped" Item');
  assert.equal(quotedCsvPreview.rows[0]?.unitPrice, 1200);
  assert.equal(quotedCsvPreview.rows[0]?.amount, 1200);

  const multilineCsvPreview = buildPurchaseHistoryImportPreview({
    sourceType: "CSV",
    existingProducts: [],
    text: buildCsv([
      [
        "2026-05-01",
        "Sample Dealer",
        "DLR-MULTILINE",
        "",
        "",
        "Multiline\nProduct",
        "Sample Maker",
        "first line\nsecond line",
        "1",
        "100",
        "100",
      ],
    ]),
  });

  assert.equal(multilineCsvPreview.summary.totalRows, 1);
  assert.equal(multilineCsvPreview.rows[0]?.status, "CREATE");
  assert.equal(multilineCsvPreview.rows[0]?.productName, "Multiline\nProduct");
  assert.equal(multilineCsvPreview.rows[0]?.specification, "first line\nsecond line");

  const carriageReturnCsvPreview = buildPurchaseHistoryImportPreview({
    sourceType: "CSV",
    existingProducts: [],
    text: buildCsv([
      [
        "2026-05-01",
        "Sample Dealer",
        "DLR-CR",
        "",
        "",
        "Carriage\rProduct",
        "Sample Maker",
        "first line\r\nsecond line",
        "1",
        "100",
        "100",
      ],
    ]),
  });

  assert.equal(carriageReturnCsvPreview.rows[0]?.productName, "Carriage\nProduct");
  assert.equal(carriageReturnCsvPreview.rows[0]?.specification, "first line\nsecond line");

  assert.throws(
    () =>
      buildPurchaseHistoryImportPreview({
        sourceType: "CSV",
        existingProducts: [],
        text: [
          "purchaseDate,dealerName,dealerProductCode,supplierProductCode,janCode,productName,manufacturer,specification,quantity,unitPrice,amount",
          '"2026-05-01","Sample Dealer","DLR-BROKEN","","","Broken',
          'Product',
        ].join("\n"),
      }),
    /引用符が閉じられていません/,
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
