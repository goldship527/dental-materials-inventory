export const stockStatusKeys = {
  out: "OUT",
  shortage: "SHORTAGE",
  atMin: "AT_MIN",
  enough: "ENOUGH",
} as const;

export type StockStatusKey = (typeof stockStatusKeys)[keyof typeof stockStatusKeys];

export type StockStatus = {
  key: StockStatusKey;
  label: string;
  badgeClassName: string;
  isShortage: boolean;
  isAtMin: boolean;
  shortageCount: number;
};

export function getStockStatus(quantity: number, minStock: number): StockStatus {
  const shortageCount = Math.max(0, minStock - quantity);

  if (quantity === 0) {
    return {
      key: stockStatusKeys.out,
      label: "在庫切れ",
      badgeClassName: "bg-red-50 text-danger",
      isShortage: quantity < minStock,
      isAtMin: false,
      shortageCount,
    };
  }

  if (quantity < minStock) {
    return {
      key: stockStatusKeys.shortage,
      label: "不足",
      badgeClassName: "bg-orange-50 text-warning",
      isShortage: true,
      isAtMin: false,
      shortageCount,
    };
  }

  if (quantity === minStock) {
    return {
      key: stockStatusKeys.atMin,
      label: "ぎりぎり",
      badgeClassName: "bg-yellow-50 text-caution",
      isShortage: false,
      isAtMin: true,
      shortageCount: 0,
    };
  }

  return {
    key: stockStatusKeys.enough,
    label: "十分",
    badgeClassName: "bg-green-50 text-success",
    isShortage: false,
    isAtMin: false,
    shortageCount: 0,
  };
}

export function isShortageStock(quantity: number, minStock: number) {
  return quantity < minStock;
}
