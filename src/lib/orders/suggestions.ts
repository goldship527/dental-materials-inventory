import type { Prisma, PrismaClient } from "@prisma/client";
import { lockOrderRequestProduct } from "@/lib/orders/locks";
import { cardStockUnit } from "@/lib/stock/card-stock-unit";

export type OrderSuggestionCalculation = {
  minStock: number;
  currentStock: number;
  pendingOrderedQuantity: number;
  plannedQuantity: number;
  targetQuantity: number;
};

export async function calculateOrderSuggestion(
  tx: Prisma.TransactionClient,
  input: { clinicId: string; organizationId: string; productId: string },
) {
  const stockItem = await tx.stockItem.findFirst({
    where: {
      clinicId: input.clinicId,
      productId: input.productId,
      clinic: { organizationId: input.organizationId },
      product: { organizationId: input.organizationId },
    },
    select: {
      id: true,
      quantity: true,
      minStock: true,
      isUsed: true,
      autoOrderSuppressedAt: true,
      product: {
        select: {
          isActive: true,
          defaultMinStock: true,
          orderUnit: true,
          stockUsageMode: true,
        },
      },
    },
  });

  if (!stockItem) return null;

  const minStock = stockItem.minStock ?? stockItem.product.defaultMinStock;
  const eligible =
    minStock > 0 &&
    stockItem.isUsed &&
    stockItem.product.isActive &&
    stockItem.product.stockUsageMode === "NONE" &&
    cardStockUnit(stockItem.product.orderUnit) !== null;
  const sums = await tx.orderRequest.groupBy({
    by: ["status"],
    where: {
      clinicId: input.clinicId,
      productId: input.productId,
      OR: [
        { status: "ORDERED", receivedAt: null },
        { status: { in: ["DRAFT", "CONFIRMED"] } },
      ],
    },
    _sum: { requestedQuantity: true },
  });
  const quantityFor = (statuses: string[]) =>
    sums
      .filter((row) => statuses.includes(row.status))
      .reduce((total, row) => total + (row._sum.requestedQuantity ?? 0), 0);
  const calculation: OrderSuggestionCalculation = {
    minStock,
    currentStock: stockItem.quantity,
    pendingOrderedQuantity: quantityFor(["ORDERED"]),
    plannedQuantity: quantityFor(["DRAFT", "CONFIRMED"]),
    targetQuantity: 0,
  };
  calculation.targetQuantity = eligible
    ? Math.max(
        0,
        calculation.minStock -
          calculation.currentStock -
          calculation.pendingOrderedQuantity -
          calculation.plannedQuantity,
      )
    : 0;

  return { stockItem, eligible, calculation };
}

export async function syncOrderSuggestion(
  tx: Prisma.TransactionClient,
  input: {
    clinicId: string;
    organizationId: string;
    productId: string;
    actorUserId: string;
  },
) {
  const result = await calculateOrderSuggestion(tx, input);
  const suggestions = await tx.orderRequest.findMany({
    where: { clinicId: input.clinicId, productId: input.productId, status: "SUGGESTED" },
    orderBy: { createdAt: "asc" },
    select: { id: true, requestedQuantity: true },
  });

  if (!result) return null;

  const { stockItem, eligible, calculation } = result;

  if (!eligible || calculation.targetQuantity <= 0) {
    if (suggestions.length > 0) {
      await tx.orderRequest.deleteMany({ where: { id: { in: suggestions.map(({ id }) => id) } } });
      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          action: "order_suggestion.removed",
          targetType: "Product",
          targetId: input.productId,
          detailsJson: {
            removedCount: suggestions.length,
            removedQuantity: suggestions.reduce((sum, row) => sum + row.requestedQuantity, 0),
          },
        },
      });
    }

    if (stockItem.autoOrderSuppressedAt && calculation.targetQuantity <= 0) {
      await tx.stockItem.update({ where: { id: stockItem.id }, data: { autoOrderSuppressedAt: null } });
    }

    return calculation;
  }

  if (stockItem.autoOrderSuppressedAt) return calculation;

  const [primarySuggestion, ...duplicateSuggestions] = suggestions;

  if (primarySuggestion) {
    await tx.orderRequest.update({
      where: { id: primarySuggestion.id },
      data: { requestedQuantity: calculation.targetQuantity },
    });

    if (duplicateSuggestions.length > 0) {
      await tx.orderRequest.deleteMany({ where: { id: { in: duplicateSuggestions.map(({ id }) => id) } } });
    }
  } else {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: input.productId },
      select: { primarySupplierId: true },
    });
    await tx.orderRequest.create({
      data: {
        clinicId: input.clinicId,
        productId: input.productId,
        supplierId: product.primarySupplierId,
        status: "SUGGESTED",
        requestedQuantity: calculation.targetQuantity,
        createdByUserId: input.actorUserId,
      },
    });
  }

  return calculation;
}

// Bulk paths (stocktake commit, bulk min-stock setup) commit their own changes first and then
// re-sync each product in a short transaction, so hundreds of products never share one 5s window.
// The result is state-based, so a failed product converges on its next stock or order change.
export async function syncOrderSuggestionsInSeparateTransactions(
  db: PrismaClient,
  input: {
    organizationId: string;
    actorUserId: string;
    scopes: Iterable<{ clinicId: string; productId: string }>;
  },
) {
  const scopes = new Map<string, { clinicId: string; productId: string }>();
  for (const scope of input.scopes) scopes.set(`${scope.clinicId}\u0000${scope.productId}`, scope);
  let failedCount = 0;

  for (const key of [...scopes.keys()].sort()) {
    const scope = scopes.get(key)!;
    try {
      await db.$transaction(async (tx) => {
        await lockOrderRequestProduct(tx, scope.clinicId, scope.productId);
        await syncOrderSuggestion(tx, {
          clinicId: scope.clinicId,
          organizationId: input.organizationId,
          productId: scope.productId,
          actorUserId: input.actorUserId,
        });
      });
    } catch {
      failedCount += 1;
    }
  }

  if (failedCount > 0) {
    console.error(`order suggestion sync failed for ${failedCount} product(s); they will converge on the next change`);
  }

  return { syncedCount: scopes.size - failedCount, failedCount };
}

export async function clearOrderSuggestionSuppression(
  tx: Prisma.TransactionClient,
  clinicId: string,
  productId: string,
) {
  await tx.stockItem.updateMany({
    where: { clinicId, productId, autoOrderSuppressedAt: { not: null } },
    data: { autoOrderSuppressedAt: null },
  });
}
