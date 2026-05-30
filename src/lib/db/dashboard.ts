import { getOrderRequestStatusCounts } from "@/lib/db/orders";
import { prisma } from "@/lib/db/prisma";
import { getStockRows } from "@/lib/db/stock";
import { countStockAnomalies } from "@/lib/db/stock-anomalies";
import { countDormantStockRows } from "@/lib/db/dormant-stock";
import { countAttentionStockLots } from "@/lib/db/stock-lots";

export type DashboardTrendPoint = {
  label: string;
  value: number;
};

export type DashboardSummary = {
  stockItemCount: number;
  shortageCount: number;
  zeroStockCount: number;
  atMinStockCount: number;
  totalQuantity: number;
  favoriteCardCount: number;
  draftOrderRequestCount: number;
  orderRequestStatusCounts: {
    DRAFT: number;
    CONFIRMED: number;
    SKIPPED: number;
    ORDERED: number;
  };
  shortageTrend: DashboardTrendPoint[];
  unresolvedBarcodeScanCount: number;
  expiringBarcodeScanCount: number;
  attentionStockLotCount: number;
  dormantStockCount: number;
  stockAnomalyCount: number;
  latestStocktakeSession: {
    id: string;
    committedAt: Date | null;
    diffCount: number;
    itemCount: number;
  } | null;
  latestMovement: {
    productName: string;
    movementType: string;
    beforeQuantity: number;
    afterQuantity: number;
    createdAt: Date;
  } | null;
  latestMovements: {
    id: string;
    productName: string;
    movementType: string;
    beforeQuantity: number;
    afterQuantity: number;
    createdAt: Date;
  }[];
};

function createRepeatedShortageTrend(shortageCount: number): DashboardTrendPoint[] {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
  });

  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (13 - index));

    return {
      label: formatter.format(date),
      value: shortageCount,
    };
  });
}

async function fallbackOnError<T>(promise: Promise<T>, fallbackValue: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallbackValue;
  }
}

export async function getDashboardSummary(clinicId: string, organizationId?: string): Promise<DashboardSummary> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const thirtyDaysLater = new Date(todayStart);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  const [
    rows,
    favoriteCardCount,
    orderRequestStatusCounts,
    latestMovements,
    unresolvedBarcodeScanCount,
    expiringBarcodeScanCount,
    attentionStockLotCount,
    dormantStockCount,
    stockAnomalyCount,
    latestStocktakeSession,
  ] = await Promise.all([
    fallbackOnError(getStockRows(clinicId), []),
    fallbackOnError(
      prisma.favoriteProductCard.count({
        where: {
          clinicId,
        },
      }),
      0,
    ),
    fallbackOnError(
      getOrderRequestStatusCounts(clinicId),
      {
        DRAFT: 0,
        CONFIRMED: 0,
        SKIPPED: 0,
        ORDERED: 0,
      },
    ),
    fallbackOnError(
      prisma.stockMovement.findMany({
        where: {
          clinicId,
        },
        select: {
          id: true,
          movementType: true,
          beforeQuantity: true,
          afterQuantity: true,
          createdAt: true,
          product: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      }),
      [],
    ),
    fallbackOnError(
      prisma.barcodeScanLog.count({
        where: {
          clinicId,
          resolveStatus: "UNRESOLVED",
          matchType: {
            in: ["NO_MATCH", "PRODUCT_MULTI", "SAMPLE"],
          },
        },
      }),
      0,
    ),
    fallbackOnError(
      prisma.barcodeScanLog.count({
        where: {
          clinicId,
          resolveStatus: {
            not: "RESOLVED_IGNORED",
          },
          expiryDate: {
            gte: todayStart,
            lte: thirtyDaysLater,
          },
        },
      }),
      0,
    ),
    fallbackOnError(countAttentionStockLots(clinicId, todayStart), 0),
    organizationId ? fallbackOnError(countDormantStockRows(organizationId, clinicId), 0) : Promise.resolve(0),
    organizationId ? fallbackOnError(countStockAnomalies(organizationId, clinicId), 0) : Promise.resolve(0),
    fallbackOnError(
      prisma.stocktakeSession.findFirst({
        where: {
          clinicId,
          status: "COMMITTED",
        },
        select: {
          id: true,
          committedAt: true,
          items: {
            select: {
              status: true,
              diff: true,
            },
          },
        },
        orderBy: {
          committedAt: "desc",
        },
      }),
      null,
    ),
  ]);
  const shortageCount = rows.filter((row) => row.isShortage).length;
  const zeroStockCount = rows.filter((row) => row.quantity === 0).length;
  const atMinStockCount = rows.filter((row) => row.isAtMin).length;
  const totalQuantity = rows.reduce((total, row) => total + row.quantity, 0);
  const latestMovement = latestMovements[0] ?? null;

  return {
    stockItemCount: rows.length,
    shortageCount,
    zeroStockCount,
    atMinStockCount,
    totalQuantity,
    favoriteCardCount,
    draftOrderRequestCount: orderRequestStatusCounts.DRAFT,
    orderRequestStatusCounts,
    shortageTrend: createRepeatedShortageTrend(shortageCount),
    unresolvedBarcodeScanCount,
    expiringBarcodeScanCount,
    attentionStockLotCount,
    dormantStockCount,
    stockAnomalyCount,
    latestStocktakeSession: latestStocktakeSession
      ? {
          id: latestStocktakeSession.id,
          committedAt: latestStocktakeSession.committedAt,
          diffCount: latestStocktakeSession.items.filter(
            (item) => item.status === "COUNTED" && item.diff !== null && item.diff !== 0,
          ).length,
          itemCount: latestStocktakeSession.items.length,
        }
      : null,
    latestMovement: latestMovement
      ? {
          productName: latestMovement.product.name,
          movementType: latestMovement.movementType,
          beforeQuantity: latestMovement.beforeQuantity,
          afterQuantity: latestMovement.afterQuantity,
          createdAt: latestMovement.createdAt,
        }
      : null,
    latestMovements: latestMovements.map((movement) => ({
      id: movement.id,
      productName: movement.product.name,
      movementType: movement.movementType,
      beforeQuantity: movement.beforeQuantity,
      afterQuantity: movement.afterQuantity,
      createdAt: movement.createdAt,
    })),
  };
}
