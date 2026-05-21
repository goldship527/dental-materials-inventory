import { getOrderRequestStatusCounts } from "@/lib/db/orders";
import { prisma } from "@/lib/db/prisma";
import { getStockRows } from "@/lib/db/stock";

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
};

function createRepeatedShortageTrend(shortageCount: number): DashboardTrendPoint[] {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
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

export async function getDashboardSummary(clinicId: string): Promise<DashboardSummary> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const thirtyDaysLater = new Date(todayStart);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  const [
    rows,
    favoriteCardCount,
    orderRequestStatusCounts,
    latestMovement,
    unresolvedBarcodeScanCount,
    expiringBarcodeScanCount,
    latestStocktakeSession,
  ] = await Promise.all([
    getStockRows(clinicId),
    prisma.favoriteProductCard.count({
      where: {
        clinicId,
      },
    }),
    getOrderRequestStatusCounts(clinicId),
    prisma.stockMovement.findFirst({
      where: {
        clinicId,
      },
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.barcodeScanLog.count({
      where: {
        clinicId,
        resolveStatus: "UNRESOLVED",
        matchType: {
          in: ["NO_MATCH", "PRODUCT_MULTI", "SAMPLE"],
        },
      },
    }),
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
  ]);
  const shortageCount = rows.filter((row) => row.isShortage).length;
  const zeroStockCount = rows.filter((row) => row.quantity === 0).length;
  const atMinStockCount = rows.filter((row) => row.isAtMin).length;
  const totalQuantity = rows.reduce((total, row) => total + row.quantity, 0);

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
  };
}
