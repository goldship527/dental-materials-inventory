import { getOrderRequestStatusCounts } from "@/lib/db/orders";
import { prisma } from "@/lib/db/prisma";
import { getStockRows } from "@/lib/db/stock";
import { countAttentionStockLots } from "@/lib/db/stock-lots";

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
  attentionStockLotCount: number;
  latestMovementAt: Date | null;
};

export type AdminOverview = {
  rows: AdminOverviewClinicRow[];
  summary: AdminOverviewSummary;
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
      attentionStockLotCount: rows.reduce((total, row) => total + row.attentionStockLotCount, 0),
      latestMovementAt,
    },
  };
}
