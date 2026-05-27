import { prisma } from "@/lib/db/prisma";
import { getProductAbcRanks, type ProductAbcRankSummary } from "@/lib/db/product-abc-ranks";

export type StocktakeSessionStatus = "IN_PROGRESS" | "COMMITTED" | "DISCARDED";
export type StocktakeSessionItemStatus = "PENDING" | "COUNTED" | "SKIPPED";

export type StocktakeSessionListRow = {
  id: string;
  status: string;
  memo: string | null;
  startedAt: Date;
  committedAt: Date | null;
  discardedAt: Date | null;
  updatedAt: Date;
  startedByUserName: string;
  committedByUserName: string | null;
  itemCount: number;
  pendingCount: number;
  countedCount: number;
  skippedCount: number;
};

export type StocktakeSessionItemRow = {
  id: string;
  productId: string;
  productCode: string | null;
  janCode: string | null;
  name: string;
  category: string | null;
  manufacturer: string | null;
  location: string | null;
  expectedQuantity: number;
  countedQuantity: number | null;
  diff: number | null;
  status: string;
  memo: string | null;
  countedAt: Date | null;
  countedByUserName: string | null;
  movementId: string | null;
  barcodeValues: string[];
  abcRank: ProductAbcRankSummary;
};

export type StocktakeSessionDetail = {
  id: string;
  status: string;
  memo: string | null;
  clinicId: string;
  startedAt: Date;
  committedAt: Date | null;
  discardedAt: Date | null;
  updatedAt: Date;
  startedByUserName: string;
  committedByUserName: string | null;
  itemCount: number;
  pendingCount: number;
  countedCount: number;
  skippedCount: number;
  diffCount: number;
  noDiffCount: number;
  rows: StocktakeSessionItemRow[];
};

function countItemStatuses(items: Array<{ status: string }>) {
  return {
    pendingCount: items.filter((item) => item.status === "PENDING").length,
    countedCount: items.filter((item) => item.status === "COUNTED").length,
    skippedCount: items.filter((item) => item.status === "SKIPPED").length,
  };
}

function toListRow(session: {
  id: string;
  status: string;
  memo: string | null;
  startedAt: Date;
  committedAt: Date | null;
  discardedAt: Date | null;
  updatedAt: Date;
  startedByUser: {
    name: string;
  };
  committedByUser: {
    name: string;
  } | null;
  items: Array<{ status: string }>;
}): StocktakeSessionListRow {
  const counts = countItemStatuses(session.items);

  return {
    id: session.id,
    status: session.status,
    memo: session.memo,
    startedAt: session.startedAt,
    committedAt: session.committedAt,
    discardedAt: session.discardedAt,
    updatedAt: session.updatedAt,
    startedByUserName: session.startedByUser.name,
    committedByUserName: session.committedByUser?.name ?? null,
    itemCount: session.items.length,
    ...counts,
  };
}

export function getStocktakeSessionStatusLabel(status: string) {
  if (status === "IN_PROGRESS") {
    return "入力中";
  }

  if (status === "COMMITTED") {
    return "確定済み";
  }

  if (status === "DISCARDED") {
    return "破棄";
  }

  return status;
}

export function getStocktakeSessionItemStatusLabel(status: string) {
  if (status === "PENDING") {
    return "未入力";
  }

  if (status === "COUNTED") {
    return "入力済み";
  }

  if (status === "SKIPPED") {
    return "スキップ";
  }

  return status;
}

export async function getStocktakeSessionIndex(clinicId: string) {
  const [inProgressSession, historySessions] = await Promise.all([
    prisma.stocktakeSession.findFirst({
      where: {
        clinicId,
        status: "IN_PROGRESS",
      },
      include: {
        startedByUser: {
          select: {
            name: true,
          },
        },
        committedByUser: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            status: true,
          },
        },
      },
      orderBy: {
        startedAt: "desc",
      },
    }),
    prisma.stocktakeSession.findMany({
      where: {
        clinicId,
        status: {
          in: ["COMMITTED", "DISCARDED"],
        },
      },
      include: {
        startedByUser: {
          select: {
            name: true,
          },
        },
        committedByUser: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            status: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 50,
    }),
  ]);

  return {
    inProgressSession: inProgressSession ? toListRow(inProgressSession) : null,
    historySessions: historySessions.map(toListRow),
  };
}

export async function getStocktakeStartSummary(clinicId: string) {
  const [inProgressSession, itemCount] = await Promise.all([
    prisma.stocktakeSession.findFirst({
      where: {
        clinicId,
        status: "IN_PROGRESS",
      },
      select: {
        id: true,
        startedAt: true,
      },
      orderBy: {
        startedAt: "desc",
      },
    }),
    prisma.stockItem.count({
      where: {
        clinicId,
        isUsed: true,
        product: {
          isActive: true,
        },
      },
    }),
  ]);

  return {
    inProgressSession,
    itemCount,
  };
}

export async function getStocktakeSessionDetail(
  sessionId: string,
  clinicId: string,
): Promise<StocktakeSessionDetail | null> {
  const session = await prisma.stocktakeSession.findFirst({
    where: {
      id: sessionId,
      clinicId,
    },
    include: {
      startedByUser: {
        select: {
          name: true,
        },
      },
      committedByUser: {
        select: {
          name: true,
        },
      },
      clinic: {
        select: {
          organizationId: true,
        },
      },
      items: {
        include: {
          countedByUser: {
            select: {
              name: true,
            },
          },
          product: {
            include: {
              barcodes: {
                select: {
                  barcode: true,
                },
              },
              stockItems: {
                where: {
                  clinicId,
                  isUsed: true,
                },
                select: {
                  location: true,
                },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  const [movements, abcRanksByProduct] = await Promise.all([
    prisma.stockMovement.findMany({
      where: {
        clinicId,
        sourceType: "STOCKTAKE_SESSION",
        sourceId: sessionId,
      },
      select: {
        id: true,
        productId: true,
      },
    }),
    getProductAbcRanks(session.clinic.organizationId, clinicId),
  ]);
  const movementIdByProductId = new Map(movements.map((movement) => [movement.productId, movement.id]));

  const rows = session.items
    .map((item) => {
      const barcodeValues = Array.from(
        new Set([item.product.janCode, ...item.product.barcodes.map((barcode) => barcode.barcode)].filter(Boolean)),
      ) as string[];

      return {
        id: item.id,
        productId: item.productId,
        productCode: item.product.productCode,
        janCode: item.product.janCode,
        name: item.product.name,
        category: item.product.category,
        manufacturer: item.product.manufacturer,
        location: item.product.stockItems[0]?.location ?? null,
        expectedQuantity: item.expectedQuantity,
        countedQuantity: item.countedQuantity,
        diff: item.diff,
        status: item.status,
        memo: item.memo,
        countedAt: item.countedAt,
        countedByUserName: item.countedByUser?.name ?? null,
        movementId: movementIdByProductId.get(item.productId) ?? null,
        barcodeValues,
        abcRank: abcRanksByProduct[item.productId] ?? {
          rank: "UNUSED",
          totalQuantity: 0,
          share: 0,
        },
      };
    })
    .sort((a, b) => {
      const categoryCompare = (a.category ?? "").localeCompare(b.category ?? "", "ja");

      if (categoryCompare !== 0) {
        return categoryCompare;
      }

      return a.name.localeCompare(b.name, "ja");
    });
  const counts = countItemStatuses(rows);
  const diffCount = rows.filter((row) => row.status === "COUNTED" && row.diff !== null && row.diff !== 0).length;
  const noDiffCount = rows.filter((row) => row.status === "COUNTED" && row.diff === 0).length;

  return {
    id: session.id,
    status: session.status,
    memo: session.memo,
    clinicId: session.clinicId,
    startedAt: session.startedAt,
    committedAt: session.committedAt,
    discardedAt: session.discardedAt,
    updatedAt: session.updatedAt,
    startedByUserName: session.startedByUser.name,
    committedByUserName: session.committedByUser?.name ?? null,
    itemCount: rows.length,
    ...counts,
    diffCount,
    noDiffCount,
    rows,
  };
}
