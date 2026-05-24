import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type StockMovementRow = {
  id: string;
  productId: string;
  productName: string;
  productCode: string | null;
  category: string | null;
  movementType: string;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  reason: string | null;
  sourceType: string | null;
  sourceId: string | null;
  revertOfId: string | null;
  revertedAt: Date | null;
  lotNumber: string | null;
  expiryDateText: string | null;
  expiryDate: Date | null;
  userName: string;
  performedByStaffName: string | null;
  createdAt: Date;
};

export type StockMovementFilters = {
  query?: string;
  movementType?: string;
  sourceType?: string;
  sourceId?: string;
  startDate?: string;
  endDate?: string;
};

export const stockMovementTypes = new Set(["IN", "OUT", "ADJUST"]);
export const stockMovementSources = new Set([
  "MANUAL",
  "QUICK_CARD",
  "BARCODE_STOCK",
  "ORDER_RECEIPT",
  "ORDER_RECEIPT_REVERT",
  "STOCKTAKE",
  "STOCKTAKE_SESSION",
  "REVERT",
]);

export const stockMovementTypeLabels: Record<string, string> = {
  IN: "入庫",
  OUT: "出庫",
  ADJUST: "調整",
};

export const stockMovementSourceLabels: Record<string, string> = {
  MANUAL: "在庫一覧",
  QUICK_CARD: "クイック出庫",
  BARCODE_STOCK: "バーコード出入庫",
  ORDER_RECEIPT: "納品確認",
  ORDER_RECEIPT_REVERT: "納品確認取り消し",
  STOCKTAKE: "棚卸",
  STOCKTAKE_SESSION: "棚卸セッション",
  REVERT: "履歴取り消し",
};

export function getStockMovementTypeLabel(movementType: string) {
  return stockMovementTypeLabels[movementType] ?? movementType;
}

export function getStockMovementSourceLabel(sourceType: string | null) {
  return sourceType ? (stockMovementSourceLabels[sourceType] ?? sourceType) : "-";
}

function parseDateStart(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00+09:00`);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseDateEndExclusive(value: string | undefined) {
  const date = parseDateStart(value);

  if (!date) {
    return undefined;
  }

  date.setUTCDate(date.getUTCDate() + 1);

  return date;
}

export function normalizeStockMovementFilters(filters: StockMovementFilters = {}): Required<StockMovementFilters> {
  const movementType = stockMovementTypes.has(filters.movementType ?? "") ? (filters.movementType ?? "") : "";
  const sourceType = stockMovementSources.has(filters.sourceType ?? "") ? (filters.sourceType ?? "") : "";

  return {
    query: filters.query?.trim() ?? "",
    movementType,
    sourceType,
    sourceId: filters.sourceId?.trim() ?? "",
    startDate: filters.startDate?.trim() ?? "",
    endDate: filters.endDate?.trim() ?? "",
  };
}

function buildSourceTypeWhere(sourceType: string): Prisma.StockMovementWhereInput | undefined {
  if (!sourceType) {
    return undefined;
  }

  if (sourceType === "STOCKTAKE") {
    return {
      OR: [
        { sourceType: "STOCKTAKE" },
        {
          sourceType: "MANUAL",
          reason: "棚卸確定",
        },
      ],
    };
  }

  return { sourceType };
}

function buildQueryWhere(query: string): Prisma.StockMovementWhereInput | undefined {
  if (!query) {
    return undefined;
  }

  const matchingMovementTypes = Object.entries(stockMovementTypeLabels)
    .filter(([key, label]) => key.toLowerCase().includes(query.toLowerCase()) || label.toLowerCase().includes(query.toLowerCase()))
    .map(([key]) => key);
  const matchingSourceTypes = Object.entries(stockMovementSourceLabels)
    .filter(([key, label]) => key.toLowerCase().includes(query.toLowerCase()) || label.toLowerCase().includes(query.toLowerCase()))
    .map(([key]) => key);
  const or: Prisma.StockMovementWhereInput[] = [
    { reason: { contains: query, mode: "insensitive" } },
    { lotNumber: { contains: query, mode: "insensitive" } },
    { expiryDateText: { contains: query, mode: "insensitive" } },
    { product: { name: { contains: query, mode: "insensitive" } } },
    { product: { productCode: { contains: query, mode: "insensitive" } } },
    { product: { category: { contains: query, mode: "insensitive" } } },
    { user: { name: { contains: query, mode: "insensitive" } } },
    { performedByStaff: { displayName: { contains: query, mode: "insensitive" } } },
  ];

  if (matchingMovementTypes.length > 0) {
    or.push({ movementType: { in: matchingMovementTypes } });
  }

  if (matchingSourceTypes.length > 0) {
    or.push({ sourceType: { in: matchingSourceTypes } });
  }

  return { OR: or };
}

function buildStockMovementWhere(clinicId: string, rawFilters: StockMovementFilters = {}): Prisma.StockMovementWhereInput {
  const filters = normalizeStockMovementFilters(rawFilters);
  const startDate = parseDateStart(filters.startDate);
  const endDate = parseDateEndExclusive(filters.endDate);
  const and: Prisma.StockMovementWhereInput[] = [{ clinicId }];
  const queryWhere = buildQueryWhere(filters.query);
  const sourceTypeWhere = buildSourceTypeWhere(filters.sourceType);

  if (queryWhere) {
    and.push(queryWhere);
  }

  if (filters.movementType) {
    and.push({ movementType: filters.movementType });
  }

  if (sourceTypeWhere) {
    and.push(sourceTypeWhere);
  }

  if (filters.sourceId) {
    and.push({ sourceId: filters.sourceId });
  }

  if (startDate || endDate) {
    and.push({
      createdAt: {
        gte: startDate,
        lt: endDate,
      },
    });
  }

  return { AND: and };
}

export async function getStockMovementCount(clinicId: string, filters: StockMovementFilters = {}) {
  return prisma.stockMovement.count({
    where: buildStockMovementWhere(clinicId, filters),
  });
}

export async function getStockMovementRows(
  clinicId: string,
  filters: StockMovementFilters = {},
  take = 100,
): Promise<StockMovementRow[]> {
  const movements = await prisma.stockMovement.findMany({
    where: buildStockMovementWhere(clinicId, filters),
    include: {
      product: {
        select: {
          name: true,
          productCode: true,
          category: true,
        },
      },
      user: {
        select: {
          name: true,
        },
      },
      performedByStaff: {
        select: {
          displayName: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take,
  });

  return movements.map((movement) => {
    const sourceType =
      movement.sourceType === "MANUAL" && movement.reason === "棚卸確定" ? "STOCKTAKE" : movement.sourceType;

    return {
      id: movement.id,
      productId: movement.productId,
      productName: movement.product.name,
      productCode: movement.product.productCode,
      category: movement.product.category,
      movementType: movement.movementType,
      quantity: movement.quantity,
      beforeQuantity: movement.beforeQuantity,
      afterQuantity: movement.afterQuantity,
      reason: movement.reason,
      sourceType,
      sourceId: movement.sourceId,
      revertOfId: movement.revertOfId,
      revertedAt: movement.revertedAt,
      lotNumber: movement.lotNumber,
      expiryDateText: movement.expiryDateText,
      expiryDate: movement.expiryDate,
      userName: movement.user.name,
      performedByStaffName: movement.performedByStaff?.displayName ?? null,
      createdAt: movement.createdAt,
    };
  });
}

export async function getRecentStockMovementRows(clinicId: string, take = 100): Promise<StockMovementRow[]> {
  return getStockMovementRows(clinicId, {}, take);
}
