import assert from "node:assert/strict";
import test from "node:test";
import { groupReceiptsByOrderDate, type ReceiptCard } from "../src/lib/orders/receipt-groups";

test("receipt groups use Japan dates and retain distinct orders for the same product", () => {
  const row = (id: string, orderedAt: string | null): ReceiptCard => ({id, productId: "product-1", photoUpdatedAt: null, orderedAt, name: "架空商品", category: null, supplierName: null, orderUnit: "箱", requestedQuantity: 2});
  const result = groupReceiptsByOrderDate([row("c", null), row("b", "2026-09-05T15:00:00Z"), row("a", "2026-09-05T14:59:59Z"), row("d", "2026-09-05T16:00:00Z")]);
  assert.deepEqual(result.map(([day, rows]) => [day, rows.map(r => r.id)]), [["2026-09-05", ["a"]], ["2026-09-06", ["b", "d"]], ["日付未登録", ["c"]]]);
  assert.deepEqual(groupReceiptsByOrderDate([]), []);
});
