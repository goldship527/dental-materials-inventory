import { prisma } from "@/lib/db/prisma";

const oneDayMs = 24 * 60 * 60 * 1000;

export type SupplierLeadTimeStats = {
  avgDays: number;
  medianDays: number;
  sampleCount: number;
  isSampleSufficient: boolean;
};

export type SupplierLeadTimesBySupplier = Record<string, SupplierLeadTimeStats>;

export function calculateLeadTimeStats(leadDays: number[], minimumSampleCount = 3): SupplierLeadTimeStats | null {
  if (leadDays.length === 0) {
    return null;
  }

  const sortedDays = [...leadDays].sort((a, b) => a - b);
  const totalDays = sortedDays.reduce((total, days) => total + days, 0);
  const middle = Math.floor(sortedDays.length / 2);
  const medianDays =
    sortedDays.length % 2 === 0 ? (sortedDays[middle - 1] + sortedDays[middle]) / 2 : sortedDays[middle];

  return {
    avgDays: Math.round((totalDays / sortedDays.length) * 10) / 10,
    medianDays: Math.round(medianDays * 10) / 10,
    sampleCount: sortedDays.length,
    isSampleSufficient: sortedDays.length >= minimumSampleCount,
  };
}

export function calculateLeadDays(orderedAt: Date, receivedAt: Date): number {
  return Math.max(0, Math.ceil((receivedAt.getTime() - orderedAt.getTime()) / oneDayMs));
}

export function getLeadTimeCutoffDate(days: number, today: Date = new Date()): Date {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);

  return cutoff;
}

export async function getSupplierLeadTimes(
  organizationId: string,
  options?: {
    days?: number;
    today?: Date;
    minimumSampleCount?: number;
  },
): Promise<SupplierLeadTimesBySupplier> {
  const days = options?.days ?? 180;
  const today = options?.today ?? new Date();
  const minimumSampleCount = options?.minimumSampleCount ?? 3;
  const cutoff = getLeadTimeCutoffDate(days, today);
  const requests = await prisma.orderRequest.findMany({
    where: {
      status: "ORDERED",
      supplierId: {
        not: null,
      },
      orderedAt: {
        not: null,
        gte: cutoff,
      },
      receivedAt: {
        not: null,
      },
      clinic: {
        organizationId,
      },
      supplier: {
        organizationId,
      },
    },
    select: {
      supplierId: true,
      orderedAt: true,
      receivedAt: true,
    },
  });
  const leadDaysBySupplier = new Map<string, number[]>();

  for (const request of requests) {
    if (!request.supplierId || !request.orderedAt || !request.receivedAt) {
      continue;
    }

    const supplierLeadDays = leadDaysBySupplier.get(request.supplierId) ?? [];
    supplierLeadDays.push(calculateLeadDays(request.orderedAt, request.receivedAt));
    leadDaysBySupplier.set(request.supplierId, supplierLeadDays);
  }

  return Object.fromEntries(
    Array.from(leadDaysBySupplier.entries()).flatMap(([supplierId, supplierLeadDays]) => {
      const stats = calculateLeadTimeStats(supplierLeadDays, minimumSampleCount);

      return stats ? [[supplierId, stats]] : [];
    }),
  );
}
