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
  userName: string;
  createdAt: Date;
};

export const stockMovementTypeLabels: Record<string, string> = {
  IN: "入庫",
  OUT: "出庫",
  ADJUST: "調整",
};

export const stockMovementSourceLabels: Record<string, string> = {
  MANUAL: "在庫一覧",
  QUICK_CARD: "よく使うカード",
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

export async function getRecentStockMovementRows(clinicId: string, take = 100): Promise<StockMovementRow[]> {
  const movements = await prisma.stockMovement.findMany({
    where: {
      clinicId,
    },
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
      userName: movement.user.name,
      createdAt: movement.createdAt,
    };
  });
}
