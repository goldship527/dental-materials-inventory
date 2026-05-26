export const productImportSources = {
  purchaseHistory: "PURCHASE_HISTORY",
} as const;

export type ProductImportSourceValue = (typeof productImportSources)[keyof typeof productImportSources];

export function isPurchaseHistoryImportSource(importSource: string | null) {
  return importSource === productImportSources.purchaseHistory;
}
