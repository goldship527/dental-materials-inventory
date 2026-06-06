import { prisma } from "@/lib/db/prisma";

export type PendingOrderSummary = {
  count: number;
  totalQuantity: number;
  latestOrderedAt: Date | null;
};

export type PendingOrderSupplierSummary = PendingOrderSummary & {
  supplierId: string | null;
  supplierName: string | null;
};

export type PendingOrdersByProduct = Record<string, PendingOrderSummary>;

export type PendingOrderDetailsByProduct = Record<
  string,
  PendingOrderSummary & {
    suppliers: PendingOrderSupplierSummary[];
  }
>;

function emptyPendingOrderSummary(): PendingOrderSummary {
  return {
    count: 0,
    totalQuantity: 0,
    latestOrderedAt: null,
  };
}

export function summarizePendingOrderRows(
  rows: Array<{
    productId: string;
    requestedQuantity: number;
    orderedAt: Date | null;
  }>,
): PendingOrdersByProduct {
  const summaries: PendingOrdersByProduct = {};

  for (const row of rows) {
    const summary = summaries[row.productId] ?? emptyPendingOrderSummary();

    summary.count += 1;
    summary.totalQuantity += row.requestedQuantity;
    if (row.orderedAt && (!summary.latestOrderedAt || row.orderedAt > summary.latestOrderedAt)) {
      summary.latestOrderedAt = row.orderedAt;
    }

    summaries[row.productId] = summary;
  }

  return summaries;
}

export async function getPendingOrdersByProduct(
  organizationId: string,
  clinicId: string,
  options?: { productIds?: string[] },
): Promise<PendingOrdersByProduct> {
  if (options?.productIds && options.productIds.length === 0) {
    return {};
  }

  const rows = await prisma.orderRequest.findMany({
    where: {
      clinicId,
      status: "ORDERED",
      receivedAt: null,
      ...(options?.productIds ? { productId: { in: options.productIds } } : {}),
      clinic: {
        organizationId,
      },
      product: {
        organizationId,
        isActive: true,
      },
    },
    select: {
      productId: true,
      requestedQuantity: true,
      orderedAt: true,
    },
  });

  return summarizePendingOrderRows(rows);
}

export async function getPendingOrderDetailsByProduct(
  organizationId: string,
  clinicId: string,
): Promise<PendingOrderDetailsByProduct> {
  const rows = await prisma.orderRequest.findMany({
    where: {
      clinicId,
      status: "ORDERED",
      receivedAt: null,
      clinic: {
        organizationId,
      },
      product: {
        organizationId,
        isActive: true,
      },
    },
    select: {
      productId: true,
      supplierId: true,
      requestedQuantity: true,
      orderedAt: true,
      supplier: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [
      {
        supplier: {
          name: "asc",
        },
      },
      {
        orderedAt: "desc",
      },
    ],
  });

  const summaries: PendingOrderDetailsByProduct = {};
  const supplierSummaries = new Map<string, PendingOrderSupplierSummary>();

  for (const row of rows) {
    const productSummary = summaries[row.productId] ?? {
      ...emptyPendingOrderSummary(),
      suppliers: [],
    };
    const supplierKey = `${row.productId}:${row.supplierId ?? "none"}`;
    const supplierSummary =
      supplierSummaries.get(supplierKey) ??
      ({
        ...emptyPendingOrderSummary(),
        supplierId: row.supplierId,
        supplierName: row.supplier?.name ?? null,
      } satisfies PendingOrderSupplierSummary);

    productSummary.count += 1;
    productSummary.totalQuantity += row.requestedQuantity;
    supplierSummary.count += 1;
    supplierSummary.totalQuantity += row.requestedQuantity;

    if (row.orderedAt && (!productSummary.latestOrderedAt || row.orderedAt > productSummary.latestOrderedAt)) {
      productSummary.latestOrderedAt = row.orderedAt;
    }
    if (row.orderedAt && (!supplierSummary.latestOrderedAt || row.orderedAt > supplierSummary.latestOrderedAt)) {
      supplierSummary.latestOrderedAt = row.orderedAt;
    }

    if (!supplierSummaries.has(supplierKey)) {
      productSummary.suppliers.push(supplierSummary);
      supplierSummaries.set(supplierKey, supplierSummary);
    }

    summaries[row.productId] = productSummary;
  }

  return summaries;
}
