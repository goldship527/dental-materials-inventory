import type { OrderRequestRow } from "@/lib/db/orders";
import { printableOrderRequestStatuses } from "@/lib/orders/status";

export const orderPrintUnassignedSupplierId = "unassigned";

export type OrderPrintGroup = {
  supplierKey: string;
  supplierId: string | null;
  supplierName: string;
  supplierAddress: string | null;
  supplierPhone: string | null;
  supplierFax: string | null;
  supplierEmail: string | null;
  supplierContactPersonName: string | null;
  supplierContactPersonEmail: string | null;
  rows: OrderRequestRow[];
  totalRequestedQuantity: number;
};

type OrderPrintFilter = {
  supplierId?: string;
};

export function getPrintableOrderRows(rows: OrderRequestRow[], filter: OrderPrintFilter = {}) {
  return rows.filter((row) => {
    if (!printableOrderRequestStatuses.includes(row.status)) {
      return false;
    }

    if (!filter.supplierId) {
      return true;
    }

    if (filter.supplierId === orderPrintUnassignedSupplierId) {
      return !row.supplierId;
    }

    return row.supplierId === filter.supplierId;
  });
}

export function getOrderPrintGroups(rows: OrderRequestRow[], filter: OrderPrintFilter = {}): OrderPrintGroup[] {
  const groups = new Map<string, OrderPrintGroup>();

  for (const row of getPrintableOrderRows(rows, filter)) {
    const supplierKey = row.supplierId ?? orderPrintUnassignedSupplierId;
    const existingGroup = groups.get(supplierKey);

    if (existingGroup) {
      existingGroup.rows.push(row);
      existingGroup.totalRequestedQuantity += row.requestedQuantity;
      continue;
    }

    groups.set(supplierKey, {
      supplierKey,
      supplierId: row.supplierId,
      supplierName: row.supplierName ?? "発注先未設定",
      supplierAddress: row.supplierAddress,
      supplierPhone: row.supplierPhone,
      supplierFax: row.supplierFax,
      supplierEmail: row.supplierEmail,
      supplierContactPersonName: row.supplierContactPersonName,
      supplierContactPersonEmail: row.supplierContactPersonEmail,
      rows: [row],
      totalRequestedQuantity: row.requestedQuantity,
    });
  }

  return Array.from(groups.values()).sort((a, b) => a.supplierName.localeCompare(b.supplierName, "ja"));
}
