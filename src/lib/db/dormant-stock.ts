import { prisma } from "@/lib/db/prisma";

const oneDayMs = 24 * 60 * 60 * 1000;

export type DormantStockRow = {
  stockItemId: string;
  productId: string;
  productCode: string | null;
  janCode: string | null;
  productName: string;
  category: string | null;
  manufacturer: string | null;
  currentQuantity: number;
  minStock: number;
  location: string | null;
  standardPrice: number | null;
  stagnantAmount: number | null;
  lastOutAt: Date | null;
  stagnantDays: number | null;
};

export function normalizeDormantDays(value: string | undefined | null): 90 | 180 | 365 {
  if (value === "180") {
    return 180;
  }

  if (value === "365") {
    return 365;
  }

  return 90;
}

export function calculateStagnantDays(lastOutAt: Date | null, today: Date = new Date()): number | null {
  if (!lastOutAt) {
    return null;
  }

  return Math.max(0, Math.floor((today.getTime() - lastOutAt.getTime()) / oneDayMs));
}

export function getDormantCutoffDate(days: number, today: Date = new Date()): Date {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);

  return cutoff;
}

export async function getDormantStockRows(
  organizationId: string,
  clinicId: string,
  days = 90,
  options?: {
    today?: Date;
  },
): Promise<DormantStockRow[]> {
  const today = options?.today ?? new Date();
  const cutoff = getDormantCutoffDate(days, today);
  const stockItems = await prisma.stockItem.findMany({
    where: {
      clinicId,
      isUsed: true,
      quantity: {
        gte: 1,
      },
      clinic: {
        organizationId,
      },
      product: {
        organizationId,
        isActive: true,
      },
    },
    include: {
      product: {
        select: {
          id: true,
          productCode: true,
          janCode: true,
          name: true,
          category: true,
          manufacturer: true,
          defaultMinStock: true,
          standardPrice: true,
        },
      },
    },
    orderBy: [
      {
        product: {
          category: "asc",
        },
      },
      {
        product: {
          name: "asc",
        },
      },
    ],
  });
  const productIds = stockItems.map((item) => item.productId);

  if (productIds.length === 0) {
    return [];
  }

  const lastOutRows = await prisma.stockMovement.groupBy({
    by: ["productId"],
    where: {
      clinicId,
      movementType: "OUT",
      productId: {
        in: productIds,
      },
      clinic: {
        organizationId,
      },
      product: {
        organizationId,
        isActive: true,
      },
    },
    _max: {
      createdAt: true,
    },
  });
  const lastOutByProduct = new Map(lastOutRows.map((row) => [row.productId, row._max.createdAt]));

  return stockItems
    .map((item) => {
      const lastOutAt = lastOutByProduct.get(item.productId) ?? null;
      const minStock = item.minStock ?? item.product.defaultMinStock;

      return {
        stockItemId: item.id,
        productId: item.product.id,
        productCode: item.product.productCode,
        janCode: item.product.janCode,
        productName: item.product.name,
        category: item.product.category,
        manufacturer: item.product.manufacturer,
        currentQuantity: item.quantity,
        minStock,
        location: item.location,
        standardPrice: item.product.standardPrice,
        stagnantAmount: item.product.standardPrice === null ? null : item.product.standardPrice * item.quantity,
        lastOutAt,
        stagnantDays: calculateStagnantDays(lastOutAt, today),
      } satisfies DormantStockRow;
    })
    .filter((row) => !row.lastOutAt || row.lastOutAt < cutoff)
    .sort((a, b) => {
      const aDays = a.stagnantDays ?? Number.POSITIVE_INFINITY;
      const bDays = b.stagnantDays ?? Number.POSITIVE_INFINITY;

      return bDays - aDays || a.productName.localeCompare(b.productName, "ja");
    });
}

export async function countDormantStockRows(organizationId: string, clinicId: string, days = 90): Promise<number> {
  const rows = await getDormantStockRows(organizationId, clinicId, days);

  return rows.length;
}
