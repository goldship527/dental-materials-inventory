import { prisma } from "@/lib/db/prisma";

export type AdminUsageExportScope = "ORGANIZATION_TOTAL" | "CLINIC";

export type AdminUsageExportDateRange = {
  startDate: Date;
  endDateExclusive: Date;
  startDateText: string;
  endDateText: string;
  dayCount: number;
};

export type AdminUsageExportRow = {
  scope: AdminUsageExportScope;
  scopeLabel: string;
  clinicId: string | null;
  clinicName: string;
  productId: string;
  productName: string;
  productCode: string | null;
  janCode: string | null;
  category: string | null;
  manufacturer: string | null;
  totalOutQuantity: number;
  movementCount: number;
  lastOutAt: Date | null;
};

const oneDayMs = 24 * 60 * 60 * 1000;
const maxUsageExportDays = 366;
const maxUsageExportGroups = 10000;

function parseDateInput(value: string | null | undefined, label: string) {
  const text = value?.trim() ?? "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${label}をYYYY-MM-DD形式で指定してください。`);
  }

  const date = new Date(`${text}T00:00:00+09:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label}の日付を確認してください。`);
  }

  return {
    date,
    text,
  };
}

export function parseAdminUsageExportDateRange(input: {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
}): AdminUsageExportDateRange {
  const start = parseDateInput(input.startDate, "開始日");
  const end = parseDateInput(input.endDate, "終了日");

  if (start.date > end.date) {
    throw new Error("開始日は終了日以前にしてください。");
  }

  const dayCount = Math.floor((end.date.getTime() - start.date.getTime()) / oneDayMs) + 1;

  if (dayCount > maxUsageExportDays) {
    throw new Error(`出力期間は${maxUsageExportDays}日以内にしてください。`);
  }

  const endDateExclusive = new Date(end.date);
  endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() + 1);

  return {
    startDate: start.date,
    endDateExclusive,
    startDateText: start.text,
    endDateText: end.text,
    dayCount,
  };
}

export function getDefaultAdminUsageExportDateRange(today = new Date()) {
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return {
    startDateText: `${year}-${month}-01`,
    endDateText: `${year}-${month}-${day}`,
  };
}

export async function getAdminUsageExportRows(options: {
  organizationId: string;
  dateRange: AdminUsageExportDateRange;
  maxGroups?: number;
}): Promise<AdminUsageExportRow[]> {
  const maxGroups = options.maxGroups ?? maxUsageExportGroups;
  const groupedMovements = await prisma.stockMovement.groupBy({
    by: ["clinicId", "productId"],
    where: {
      movementType: "OUT",
      createdAt: {
        gte: options.dateRange.startDate,
        lt: options.dateRange.endDateExclusive,
      },
      clinic: {
        organizationId: options.organizationId,
        isActive: true,
      },
    },
    _sum: {
      quantity: true,
    },
    _count: {
      _all: true,
    },
    _max: {
      createdAt: true,
    },
  });

  if (groupedMovements.length > maxGroups) {
    throw new Error(`集計結果が多すぎます。期間を短くして${maxGroups}行以内にしてください。`);
  }

  const clinicIds = Array.from(new Set(groupedMovements.map((row) => row.clinicId)));
  const productIds = Array.from(new Set(groupedMovements.map((row) => row.productId)));
  const [clinics, products] = await Promise.all([
    prisma.clinic.findMany({
      where: {
        id: {
          in: clinicIds,
        },
        organizationId: options.organizationId,
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
        organizationId: options.organizationId,
      },
      select: {
        id: true,
        name: true,
        productCode: true,
        janCode: true,
        category: true,
        manufacturer: true,
      },
    }),
  ]);
  const clinicById = new Map(clinics.map((clinic) => [clinic.id, clinic]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const clinicRows: AdminUsageExportRow[] = [];
  const organizationTotals = new Map<string, AdminUsageExportRow>();

  for (const row of groupedMovements) {
    const clinic = clinicById.get(row.clinicId);
    const product = productById.get(row.productId);

    if (!clinic || !product) {
      continue;
    }

    const totalOutQuantity = Math.abs(row._sum.quantity ?? 0);
    const movementCount = row._count._all;
    const lastOutAt = row._max.createdAt ?? null;

    clinicRows.push({
      scope: "CLINIC",
      scopeLabel: "クリニック別",
      clinicId: clinic.id,
      clinicName: clinic.name,
      productId: product.id,
      productName: product.name,
      productCode: product.productCode,
      janCode: product.janCode,
      category: product.category,
      manufacturer: product.manufacturer,
      totalOutQuantity,
      movementCount,
      lastOutAt,
    });

    const totalRow =
      organizationTotals.get(product.id) ??
      ({
        scope: "ORGANIZATION_TOTAL",
        scopeLabel: "法人合計",
        clinicId: null,
        clinicName: "法人全体",
        productId: product.id,
        productName: product.name,
        productCode: product.productCode,
        janCode: product.janCode,
        category: product.category,
        manufacturer: product.manufacturer,
        totalOutQuantity: 0,
        movementCount: 0,
        lastOutAt: null,
      } satisfies AdminUsageExportRow);

    totalRow.totalOutQuantity += totalOutQuantity;
    totalRow.movementCount += movementCount;

    if (lastOutAt && (!totalRow.lastOutAt || lastOutAt > totalRow.lastOutAt)) {
      totalRow.lastOutAt = lastOutAt;
    }

    organizationTotals.set(product.id, totalRow);
  }

  const organizationRows = Array.from(organizationTotals.values()).sort((a, b) =>
    a.productName.localeCompare(b.productName, "ja-JP"),
  );
  const sortedClinicRows = clinicRows.sort(
    (a, b) =>
      a.clinicName.localeCompare(b.clinicName, "ja-JP") ||
      a.productName.localeCompare(b.productName, "ja-JP"),
  );

  return [...organizationRows, ...sortedClinicRows];
}
