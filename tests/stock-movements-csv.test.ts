import assert from "node:assert/strict";
import { buildStockMovementsCsv } from "../src/lib/exports/stock-movements-csv";
import type { StockMovementRow } from "../src/lib/db/stock-movements";

const row: StockMovementRow = {
  id: "movement-1",
  productId: "product-1",
  productName: "=危険な商品名",
  productCode: "P-001",
  category: "材料",
  movementType: "OUT",
  quantity: -2,
  beforeQuantity: 10,
  afterQuantity: 8,
  reason: "使用: 午前診療分",
  sourceType: "BARCODE_STOCK",
  sourceId: null,
  revertOfId: null,
  revertedAt: null,
  lotNumber: "LOT-001",
  expiryDateText: null,
  expiryDate: new Date("2026-05-23T00:00:00+09:00"),
  userName: "Test User",
  performedByStaffName: "Help Staff",
  createdAt: new Date("2026-05-23T09:30:00+09:00"),
};

const csv = buildStockMovementsCsv([row]);

assert.ok(csv.startsWith("\uFEFF"), "Excel向けにUTF-8 BOMを付ける");
assert.ok(csv.includes('"日時","商品名","商品コード"'), "日本語ヘッダーを出力する");
assert.ok(csv.includes(`"'=危険な商品名"`), "式として解釈されやすい文字列を保護する");
assert.ok(csv.includes('"-2"'), "増減数は数値として扱える形で出力する");
assert.ok(csv.includes('"バーコード出入庫"'), "操作元を利用者向けラベルで出力する");
