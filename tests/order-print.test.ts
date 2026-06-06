import assert from "node:assert/strict";
import type { OrderRequestRow } from "../src/lib/db/orders";
import {
  getOrderPrintGroups,
  getPrintableOrderRows,
  orderPrintUnassignedSupplierId,
} from "../src/lib/orders/print";

function buildRow(overrides: Partial<OrderRequestRow>): OrderRequestRow {
  return {
    id: "request-1",
    productId: "product-1",
    productCode: "P-001",
    name: "Print Test Product",
    category: "Consumables",
    supplierId: "supplier-1",
    orderRecordId: null,
    supplierName: "Print Supplier",
    supplierAddress: "Sample Address",
    supplierPhone: "03-0000-0000",
    supplierFax: "03-0000-0001",
    supplierEmail: "orders@example.test",
    supplierContactPersonName: "Sample Contact",
    supplierContactPersonEmail: "contact@example.test",
    supplierProductCode: "SUP-001",
    orderUnit: "box",
    standardPrice: 1000,
    supplierOptions: [],
    quantity: 0,
    minStock: 2,
    shortageCount: 2,
    requestedQuantity: 2,
    status: "DRAFT",
    memo: null,
    orderedAt: null,
    orderedMethod: null,
    orderedMemo: null,
    supplierResponseMemo: null,
    receivedQuantity: null,
    receivedAt: null,
    receivedMemo: null,
    receivedLotNumber: null,
    receivedExpiryDateText: null,
    receivedExpiryDate: null,
    receivedByUserName: null,
    updatedAt: new Date("2026-05-21T00:00:00.000Z"),
    ...overrides,
  };
}

const rows = [
  buildRow({
    id: "request-1",
    supplierId: "supplier-1",
    supplierName: "Print Supplier",
    requestedQuantity: 2,
    status: "DRAFT",
  }),
  buildRow({
    id: "request-2",
    productId: "product-2",
    supplierId: "supplier-1",
    supplierName: "Print Supplier",
    requestedQuantity: 3,
    status: "CONFIRMED",
  }),
  buildRow({
    id: "request-3",
    productId: "product-3",
    supplierId: null,
    supplierName: null,
    supplierAddress: null,
    supplierPhone: null,
    supplierFax: null,
    supplierEmail: null,
    supplierContactPersonName: null,
    supplierContactPersonEmail: null,
    requestedQuantity: 4,
    status: "DRAFT",
  }),
  buildRow({
    id: "request-4",
    productId: "product-4",
    requestedQuantity: 5,
    status: "SKIPPED",
  }),
  buildRow({
    id: "request-5",
    productId: "product-5",
    requestedQuantity: 6,
    status: "ORDERED",
  }),
];

const printableRows = getPrintableOrderRows(rows);
const supplierRows = getPrintableOrderRows(rows, { supplierId: "supplier-1" });
const unassignedRows = getPrintableOrderRows(rows, { supplierId: orderPrintUnassignedSupplierId });
const groups = getOrderPrintGroups(rows);
const supplierOnlyGroups = getOrderPrintGroups(rows, { supplierId: "supplier-1" });
const supplierGroup = groups.find((group) => group.supplierId === "supplier-1");
const noSupplierGroup = groups.find((group) => group.supplierId === null);

assert.deepEqual(
  printableRows.map((row) => row.id),
  ["request-1", "request-2", "request-3"],
);
assert.deepEqual(
  supplierRows.map((row) => row.id),
  ["request-1", "request-2"],
);
assert.deepEqual(
  unassignedRows.map((row) => row.id),
  ["request-3"],
);
assert.equal(groups.length, 2);
assert.equal(supplierOnlyGroups.length, 1);
assert.equal(supplierOnlyGroups[0]?.supplierId, "supplier-1");
assert.ok(supplierGroup);
assert.equal(supplierGroup.supplierName, "Print Supplier");
assert.equal(supplierGroup.supplierPhone, "03-0000-0000");
assert.equal(supplierGroup.rows.length, 2);
assert.equal(supplierGroup.totalRequestedQuantity, 5);
assert.ok(noSupplierGroup);
assert.equal(noSupplierGroup.supplierName, "発注先未設定");
assert.equal(noSupplierGroup.rows.length, 1);
