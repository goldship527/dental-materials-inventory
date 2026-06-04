import { prisma } from "@/lib/db/prisma";
import { sumOutQuantitiesByProduct } from "@/lib/stock/out-quantity";

export type ProductAbcRank = "A" | "B" | "C" | "UNUSED";

export type ProductAbcRankSummary = {
  rank: ProductAbcRank;
  totalQuantity: number;
  share: number;
};

export type ProductAbcRanksByProduct = Record<string, ProductAbcRankSummary>;

type ProductUsageInput = {
  productId: string;
  totalQuantity: number;
};

const defaultRankThresholds = {
  a: 0.7,
  b: 0.9,
};

export function calculateProductAbcRanks(
  productUsages: ProductUsageInput[],
  thresholds = defaultRankThresholds,
): ProductAbcRanksByProduct {
  const normalizedUsages = productUsages.map((usage) => ({
    productId: usage.productId,
    totalQuantity: Math.max(0, usage.totalQuantity),
  }));
  const totalQuantity = normalizedUsages.reduce((total, usage) => total + usage.totalQuantity, 0);

  if (totalQuantity <= 0) {
    return Object.fromEntries(
      normalizedUsages.map((usage) => [
        usage.productId,
        {
          rank: "UNUSED",
          totalQuantity: 0,
          share: 0,
        },
      ]),
    );
  }

  const sortedUsages = [...normalizedUsages].sort((a, b) => {
    const quantityCompare = b.totalQuantity - a.totalQuantity;

    if (quantityCompare !== 0) {
      return quantityCompare;
    }

    return a.productId.localeCompare(b.productId);
  });
  let cumulativeQuantity = 0;
  const result: ProductAbcRanksByProduct = {};

  for (const usage of sortedUsages) {
    if (usage.totalQuantity <= 0) {
      result[usage.productId] = {
        rank: "UNUSED",
        totalQuantity: 0,
        share: 0,
      };
      continue;
    }

    const previousCumulativeShare = cumulativeQuantity / totalQuantity;
    cumulativeQuantity += usage.totalQuantity;
    const share = usage.totalQuantity / totalQuantity;
    const rank: ProductAbcRank =
      previousCumulativeShare < thresholds.a ? "A" : previousCumulativeShare < thresholds.b ? "B" : "C";

    result[usage.productId] = {
      rank,
      totalQuantity: usage.totalQuantity,
      share: Math.round(share * 1000) / 1000,
    };
  }

  return result;
}

export function getProductAbcCutoffDate(days: number, today: Date = new Date()): Date {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

export async function getProductAbcRanks(
  organizationId: string,
  clinicId: string,
  options?: { days?: number; today?: Date },
): Promise<ProductAbcRanksByProduct> {
  const days = options?.days ?? 90;
  const today = options?.today ?? new Date();
  const cutoff = getProductAbcCutoffDate(days, today);
  const [products, outMovements] = await Promise.all([
    prisma.product.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: {
        id: true,
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
      },
      select: {
        productId: true,
        quantity: true,
      },
    }),
  ]);
  const quantityByProduct = sumOutQuantitiesByProduct(outMovements);

  return calculateProductAbcRanks(
    products.map((product) => ({
      productId: product.id,
      totalQuantity: quantityByProduct.get(product.id) ?? 0,
    })),
  );
}
