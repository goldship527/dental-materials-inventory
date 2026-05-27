import { getOrderRequestStatusCounts } from "@/lib/db/orders";
import { prisma } from "@/lib/db/prisma";
import { getStockRows } from "@/lib/db/stock";
import { countAttentionStockLots, getStockLotRows, isStockLotVisibleByFilter, type StockLotRow } from "@/lib/db/stock-lots";
import type { StockRow } from "@/lib/db/stock";
import type { OrderRequestStatusCounts } from "@/lib/db/orders";

export type AdminOverviewClinicRow = {
  clinicId: string;
  clinicName: string;
  clinicAddress: string | null;
  stockItemCount: number;
  totalQuantity: number;
  shortageCount: number;
  zeroStockCount: number;
  draftOrderRequestCount: number;
  confirmedOrderRequestCount: number;
  orderedRequestCount: number;
  attentionStockLotCount: number;
  latestMovementAt: Date | null;
};

export type AdminOverviewSummary = {
  clinicCount: number;
  stockItemCount: number;
  totalQuantity: number;
  shortageCount: number;
  zeroStockCount: number;
  draftOrderRequestCount: number;
  confirmedOrderRequestCount: number;
  attentionStockLotCount: number;
  latestMovementAt: Date | null;
};

export type AdminOverview = {
  rows: AdminOverviewClinicRow[];
  summary: AdminOverviewSummary;
};

export type AdminOverviewClinicDetail = {
  clinic: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
  };
  stockRows: StockRow[];
  categories: string[];
  attentionStockLotRows: StockLotRow[];
  orderStatusCounts: OrderRequestStatusCounts;
  summary: {
    stockItemCount: number;
    totalQuantity: number;
    shortageCount: number;
    zeroStockCount: number;
    atMinStockCount: number;
    attentionStockLotCount: number;
    latestMovementAt: Date | null;
  };
};

async function getClinicOverviewRow(clinic: {
  id: string;
  name: string;
  address: string | null;
}): Promise<AdminOverviewClinicRow> {
  const [stockRows, orderStatusCounts, attentionStockLotCount, latestMovement] = await Promise.all([
    getStockRows(clinic.id),
    getOrderRequestStatusCounts(clinic.id),
    countAttentionStockLots(clinic.id),
    prisma.stockMovement.findFirst({
      where: {
        clinicId: clinic.id,
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);
  const shortageCount = stockRows.filter((row) => row.isShortage).length;
  const zeroStockCount = stockRows.filter((row) => row.quantity === 0).length;
  const totalQuantity = stockRows.reduce((total, row) => total + row.quantity, 0);

  return {
    clinicId: clinic.id,
    clinicName: clinic.name,
    clinicAddress: clinic.address,
    stockItemCount: stockRows.length,
    totalQuantity,
    shortageCount,
    zeroStockCount,
    draftOrderRequestCount: orderStatusCounts.DRAFT,
    confirmedOrderRequestCount: orderStatusCounts.CONFIRMED,
    orderedRequestCount: orderStatusCounts.ORDERED,
    attentionStockLotCount,
    latestMovementAt: latestMovement?.createdAt ?? null,
  };
}

export async function getAdminOverview(organizationId: string): Promise<AdminOverview> {
  const clinics = await prisma.clinic.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      address: true,
    },
    orderBy: {
      name: "asc",
    },
  });
  const rows = await Promise.all(clinics.map(getClinicOverviewRow));
  const latestMovementAt = rows.reduce<Date | null>((latest, row) => {
    if (!row.latestMovementAt) {
      return latest;
    }

    if (!latest || row.latestMovementAt > latest) {
      return row.latestMovementAt;
    }

    return latest;
  }, null);

  return {
    rows,
    summary: {
      clinicCount: rows.length,
      stockItemCount: rows.reduce((total, row) => total + row.stockItemCount, 0),
      totalQuantity: rows.reduce((total, row) => total + row.totalQuantity, 0),
      shortageCount: rows.reduce((total, row) => total + row.shortageCount, 0),
      zeroStockCount: rows.reduce((total, row) => total + row.zeroStockCount, 0),
      draftOrderRequestCount: rows.reduce((total, row) => total + row.draftOrderRequestCount, 0),
      confirmedOrderRequestCount: rows.reduce((total, row) => total + row.confirmedOrderRequestCount, 0),
      attentionStockLotCount: rows.reduce((total, row) => total + row.attentionStockLotCount, 0),
      latestMovementAt,
    },
  };
}

export async function getAdminOverviewClinicDetail(
  organizationId: string,
  clinicId: string,
): Promise<AdminOverviewClinicDetail | null> {
  const clinic = await prisma.clinic.findFirst({
    where: {
      id: clinicId,
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
    },
  });

  if (!clinic) {
    return null;
  }

  const [stockRows, orderStatusCounts, stockLotRows, latestMovement] = await Promise.all([
    getStockRows(clinic.id),
    getOrderRequestStatusCounts(clinic.id),
    getStockLotRows(clinic.id),
    prisma.stockMovement.findFirst({
      where: {
        clinicId: clinic.id,
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);
  const shortageCount = stockRows.filter((row) => row.isShortage).length;
  const zeroStockCount = stockRows.filter((row) => row.quantity === 0).length;
  const atMinStockCount = stockRows.filter((row) => row.isAtMin).length;
  const totalQuantity = stockRows.reduce((total, row) => total + row.quantity, 0);
  const categories = Array.from(
    new Set(stockRows.map((row) => row.category).filter((category): category is string => Boolean(category))),
  ).sort((a, b) => a.localeCompare(b, "ja-JP"));
  const attentionStockLotRows = stockLotRows.filter((row) => isStockLotVisibleByFilter(row.status, "attention"));

  return {
    clinic,
    stockRows,
    categories,
    attentionStockLotRows,
    orderStatusCounts,
    summary: {
      stockItemCount: stockRows.length,
      totalQuantity,
      shortageCount,
      zeroStockCount,
      atMinStockCount,
      attentionStockLotCount: attentionStockLotRows.length,
      latestMovementAt: latestMovement?.createdAt ?? null,
    },
  };
}
