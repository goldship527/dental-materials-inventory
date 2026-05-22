import { prisma } from "@/lib/db/prisma";

export type StockLotExpiryStatus = "expired" | "expiring" | "valid" | "undated";

export type StockLotExpiryFilter = "attention" | "expired" | "expiring" | "all";

export type StockLotRow = {
  id: string;
  productId: string;
  productCode: string | null;
  janCode: string | null;
  productName: string;
  category: string | null;
  manufacturer: string | null;
  lotNumber: string;
  expiryDateText: string;
  expiryDate: Date | null;
  quantity: number;
  updatedAt: Date;
  status: StockLotExpiryStatus;
  statusLabel: string;
  statusBadgeClassName: string;
  daysUntilExpiry: number | null;
};

const oneDayMs = 24 * 60 * 60 * 1000;

export function normalizeStockLotFilter(value: string | undefined | null): StockLotExpiryFilter {
  if (value === "expired" || value === "expiring" || value === "all") {
    return value;
  }

  return "attention";
}

export function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);

  return date;
}

export function getStockLotExpiryStatus(
  expiryDate: Date | null,
  today: Date = new Date(),
  expiringWithinDays = 30,
): {
  status: StockLotExpiryStatus;
  statusLabel: string;
  statusBadgeClassName: string;
  daysUntilExpiry: number | null;
} {
  if (!expiryDate) {
    return {
      status: "undated",
      statusLabel: "期限未登録",
      statusBadgeClassName: "bg-gray-100 text-muted",
      daysUntilExpiry: null,
    };
  }

  const todayStart = startOfDay(today);
  const expiryStart = startOfDay(expiryDate);
  const daysUntilExpiry = Math.round((expiryStart.getTime() - todayStart.getTime()) / oneDayMs);

  if (daysUntilExpiry < 0) {
    return {
      status: "expired",
      statusLabel: "期限切れ",
      statusBadgeClassName: "bg-red-50 text-danger",
      daysUntilExpiry,
    };
  }

  if (daysUntilExpiry <= expiringWithinDays) {
    return {
      status: "expiring",
      statusLabel: `${expiringWithinDays}日以内`,
      statusBadgeClassName: "bg-yellow-50 text-warning",
      daysUntilExpiry,
    };
  }

  return {
    status: "valid",
    statusLabel: "期限あり",
    statusBadgeClassName: "bg-emerald-50 text-accent",
    daysUntilExpiry,
  };
}

export function isStockLotVisibleByFilter(status: StockLotExpiryStatus, filter: StockLotExpiryFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "attention") {
    return status === "expired" || status === "expiring";
  }

  return status === filter;
}

export async function getStockLotRows(
  clinicId: string,
  options?: {
    today?: Date;
    expiringWithinDays?: number;
  },
): Promise<StockLotRow[]> {
  const today = options?.today ?? new Date();
  const expiringWithinDays = options?.expiringWithinDays ?? 30;
  const lots = await prisma.stockLot.findMany({
    where: {
      clinicId,
      quantity: {
        gt: 0,
      },
      product: {
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
        },
      },
    },
    orderBy: [
      {
        expiryDate: "asc",
      },
      {
        product: {
          name: "asc",
        },
      },
      {
        lotNumber: "asc",
      },
    ],
  });

  return lots.map((lot) => {
    const status = getStockLotExpiryStatus(lot.expiryDate, today, expiringWithinDays);

    return {
      id: lot.id,
      productId: lot.product.id,
      productCode: lot.product.productCode,
      janCode: lot.product.janCode,
      productName: lot.product.name,
      category: lot.product.category,
      manufacturer: lot.product.manufacturer,
      lotNumber: lot.lotNumber,
      expiryDateText: lot.expiryDateText,
      expiryDate: lot.expiryDate,
      quantity: lot.quantity,
      updatedAt: lot.updatedAt,
      ...status,
    };
  });
}

export async function countAttentionStockLots(clinicId: string, today: Date = new Date(), expiringWithinDays = 30): Promise<number> {
  const rows = await getStockLotRows(clinicId, {
    today,
    expiringWithinDays,
  });

  return rows.filter((row) => isStockLotVisibleByFilter(row.status, "attention")).length;
}
