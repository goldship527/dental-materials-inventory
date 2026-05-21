export type BarcodeStockMovementType = "IN" | "OUT";

export const barcodeStockOutReasons = ["使用", "その他"] as const;
export const barcodeStockInReasons = ["納品", "返品戻り", "その他"] as const;

export function getBarcodeStockReasons(movementType: BarcodeStockMovementType) {
  return movementType === "OUT" ? barcodeStockOutReasons : barcodeStockInReasons;
}

export function isAllowedBarcodeStockReason(movementType: BarcodeStockMovementType, reason: string) {
  return (getBarcodeStockReasons(movementType) as readonly string[]).includes(reason);
}
