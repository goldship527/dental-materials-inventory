export const stockUsageModes = {
  none: "NONE",
  inUse: "IN_USE",
} as const;

export type StockUsageMode = (typeof stockUsageModes)[keyof typeof stockUsageModes];

export const stockUsageModeLabels: Record<StockUsageMode, string> = {
  NONE: "なし",
  IN_USE: "あり",
};

export function isStockUsageMode(value: string): value is StockUsageMode {
  return value === stockUsageModes.none || value === stockUsageModes.inUse;
}

export function normalizeStockUsageMode(value: FormDataEntryValue | null): StockUsageMode {
  const text = typeof value === "string" ? value : "";

  return isStockUsageMode(text) ? text : stockUsageModes.none;
}
