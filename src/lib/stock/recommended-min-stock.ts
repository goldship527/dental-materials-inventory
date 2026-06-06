import { prisma } from "@/lib/db/prisma";
import { getSupplierLeadTimes } from "@/lib/db/supplier-lead-times";
import { sumOutQuantitiesByProduct } from "@/lib/stock/out-quantity";

export type RecommendedMinStockSummary = {
  recommended: number | null;
  totalOut90d: number;
  monthlyUsage: number;
  leadDays: number;
  safetyFactor: number;
  sampleSufficient: boolean;
  usesFallbackLeadTime: boolean;
  leadTimeSampleCount: number | null;
};

export type RecommendedMinStocksByProduct = Record<string, RecommendedMinStockSummary>;

const defaultLeadDays = 7;
const defaultSafetyFactor = 1.5;

export function calculateRecommendedMinStock(input: {
  totalOut90d: number;
  leadDays: number;
  safetyFactor?: number;
}): number | null {
  if (input.totalOut90d <= 0) {
    return null;
  }

  const safetyFactor = input.safetyFactor ?? defaultSafetyFactor;
  const monthlyUsage = input.totalOut90d / 3;

  return Math.ceil((monthlyUsage / 30) * input.leadDays * safetyFactor);
}

export function buildRecommendedMinStockSummary(input: {
  totalOut90d: number;
  leadDays: number;
  safetyFactor?: number;
  usesFallbackLeadTime?: boolean;
  leadTimeSampleCount?: number | null;
}): RecommendedMinStockSummary {
  const safetyFactor = input.safetyFactor ?? defaultSafetyFactor;
  const recommended = calculateRecommendedMinStock({
    totalOut90d: input.totalOut90d,
    leadDays: input.leadDays,
    safetyFactor,
  });

  return {
    recommended,
    totalOut90d: input.totalOut90d,
    monthlyUsage: Math.round((input.totalOut90d / 3) * 10) / 10,
    leadDays: Math.round(input.leadDays * 10) / 10,
    safetyFactor,
    sampleSufficient: recommended !== null,
    usesFallbackLeadTime: input.usesFallbackLeadTime ?? false,
    leadTimeSampleCount: input.leadTimeSampleCount ?? null,
  };
}

export function getRecommendedMinStockCutoffDate(days: number, today: Date = new Date()): Date {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

export async function getRecommendedMinStocks(
  organizationId: string,
  clinicId: string,
  options?: {
    days?: number;
    today?: Date;
    fallbackLeadDays?: number;
    safetyFactor?: number;
    productIds?: string[];
  },
): Promise<RecommendedMinStocksByProduct> {
  if (options?.productIds && options.productIds.length === 0) {
    return {};
  }

  const days = options?.days ?? 90;
  const today = options?.today ?? new Date();
  const fallbackLeadDays = options?.fallbackLeadDays ?? defaultLeadDays;
  const safetyFactor = options?.safetyFactor ?? defaultSafetyFactor;
  const cutoff = getRecommendedMinStockCutoffDate(days, today);
  const [products, outMovements, supplierLeadTimes] = await Promise.all([
    prisma.product.findMany({
      where: {
        organizationId,
        isActive: true,
        ...(options?.productIds ? { id: { in: options.productIds } } : {}),
      },
      select: {
        id: true,
        primarySupplierId: true,
      },
    }),
    prisma.stockMovement.findMany({
      where: {
        clinicId,
        movementType: "OUT",
        createdAt: {
          gte: cutoff,
        },
        product: {
          organizationId,
          isActive: true,
        },
        ...(options?.productIds ? { productId: { in: options.productIds } } : {}),
      },
      select: {
        productId: true,
        quantity: true,
      },
    }),
    getSupplierLeadTimes(organizationId),
  ]);
  const totalOutByProduct = sumOutQuantitiesByProduct(outMovements);

  return Object.fromEntries(
    products.map((product) => {
      const leadTime = product.primarySupplierId ? supplierLeadTimes[product.primarySupplierId] : undefined;
      const hasReliableLeadTime = Boolean(leadTime?.isSampleSufficient);
      const leadDays = hasReliableLeadTime && leadTime ? leadTime.avgDays : fallbackLeadDays;

      return [
        product.id,
        buildRecommendedMinStockSummary({
          totalOut90d: totalOutByProduct.get(product.id) ?? 0,
          leadDays,
          safetyFactor,
          usesFallbackLeadTime: !hasReliableLeadTime,
          leadTimeSampleCount: leadTime?.sampleCount ?? null,
        }),
      ];
    }),
  );
}
