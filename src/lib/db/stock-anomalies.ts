import { getOrganizationSettings } from "@/lib/db/organization-settings";
import { prisma } from "@/lib/db/prisma";

export type StockAnomalyDecision = {
  isAnomaly: boolean;
  ratio: number;
};

export type StockAnomalyRow = {
  productId: string;
  productName: string;
  productCode: string | null;
  category: string | null;
  todayQuantity: number;
  baselineDaily: number;
  ratio: number;
  threshold: number;
  operatorNames: string[];
  latestMovementAt: Date | null;
};

const oneDayMs = 24 * 60 * 60 * 1000;
const minimumBaselineDaily = 0.1;

export function detectAnomaly(input: {
  baselineDaily: number;
  todayQuantity: number;
  threshold: number;
  minimumBaselineDaily?: number;
}): StockAnomalyDecision {
  const minimum = input.minimumBaselineDaily ?? minimumBaselineDaily;

  if (input.baselineDaily < minimum || input.todayQuantity <= 0) {
    return {
      isAnomaly: false,
      ratio: 0,
    };
  }

  const ratio = input.todayQuantity / input.baselineDaily;

  return {
    isAnomaly: input.todayQuantity >= input.baselineDaily * input.threshold,
    ratio: Math.round(ratio * 10) / 10,
  };
}

export function getAnomalyWindows(now: Date = new Date()) {
  const recentStart = new Date(now.getTime() - oneDayMs);
  const baselineStart = new Date(recentStart.getTime() - 30 * oneDayMs);

  return {
    baselineStart,
    recentStart,
    now,
  };
}

export async function getStockAnomalies(
  organizationId: string,
  clinicId: string,
  options?: { now?: Date; threshold?: number },
): Promise<StockAnomalyRow[]> {
  const now = options?.now ?? new Date();
  const { baselineStart, recentStart } = getAnomalyWindows(now);
  const threshold = options?.threshold ?? (await getOrganizationSettings(organizationId)).anomalyOutThreshold;
  const [baselineGroups, recentGroups, recentMovements] = await Promise.all([
    prisma.stockMovement.groupBy({
      by: ["productId"],
      where: {
        clinicId,
        movementType: "OUT",
        createdAt: {
          gte: baselineStart,
          lt: recentStart,
        },
        product: {
          organizationId,
          isActive: true,
        },
      },
      _sum: {
        quantity: true,
      },
    }),
    prisma.stockMovement.groupBy({
      by: ["productId"],
      where: {
        clinicId,
        movementType: "OUT",
        createdAt: {
          gte: recentStart,
          lte: now,
        },
        product: {
          organizationId,
          isActive: true,
        },
      },
      _sum: {
        quantity: true,
      },
    }),
    prisma.stockMovement.findMany({
      where: {
        clinicId,
        movementType: "OUT",
        createdAt: {
          gte: recentStart,
          lte: now,
        },
        product: {
          organizationId,
          isActive: true,
        },
      },
      select: {
        productId: true,
        createdAt: true,
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
        product: {
          select: {
            id: true,
            name: true,
            productCode: true,
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);
  const baselineByProduct = new Map(
    baselineGroups.map((group) => [group.productId, (group._sum.quantity ?? 0) / 30]),
  );
  const recentQuantityByProduct = new Map(
    recentGroups.map((group) => [group.productId, group._sum.quantity ?? 0]),
  );
  const recentDetailsByProduct = new Map<
    string,
    {
      productId: string;
      productName: string;
      productCode: string | null;
      category: string | null;
      operatorNames: Set<string>;
      latestMovementAt: Date | null;
    }
  >();

  for (const movement of recentMovements) {
    const existing = recentDetailsByProduct.get(movement.productId);
    const detail =
      existing ??
      {
        productId: movement.product.id,
        productName: movement.product.name,
        productCode: movement.product.productCode,
        category: movement.product.category,
        operatorNames: new Set<string>(),
        latestMovementAt: null,
      };
    const operatorName = movement.performedByStaff?.displayName ?? movement.user.name;

    detail.operatorNames.add(operatorName);

    if (!detail.latestMovementAt || movement.createdAt > detail.latestMovementAt) {
      detail.latestMovementAt = movement.createdAt;
    }

    recentDetailsByProduct.set(movement.productId, detail);
  }

  return Array.from(recentQuantityByProduct.entries())
    .flatMap(([productId, todayQuantity]) => {
      const baselineDaily = baselineByProduct.get(productId) ?? 0;
      const decision = detectAnomaly({
        baselineDaily,
        todayQuantity,
        threshold,
      });
      const detail = recentDetailsByProduct.get(productId);

      if (!decision.isAnomaly || !detail) {
        return [];
      }

      return [
        {
          productId: detail.productId,
          productName: detail.productName,
          productCode: detail.productCode,
          category: detail.category,
          todayQuantity,
          baselineDaily: Math.round(baselineDaily * 10) / 10,
          ratio: decision.ratio,
          threshold,
          operatorNames: Array.from(detail.operatorNames).sort((a, b) => a.localeCompare(b, "ja")),
          latestMovementAt: detail.latestMovementAt,
        },
      ];
    })
    .sort((a, b) => b.ratio - a.ratio || b.todayQuantity - a.todayQuantity || a.productName.localeCompare(b.productName, "ja"));
}

export async function countStockAnomalies(organizationId: string, clinicId: string) {
  const rows = await getStockAnomalies(organizationId, clinicId);

  return rows.length;
}
