export type OrderRequestStatusValue = "SUGGESTED" | "DRAFT" | "CONFIRMED" | "SKIPPED" | "ORDERED";

export const allOrderRequestStatuses: OrderRequestStatusValue[] = ["SUGGESTED", "DRAFT", "CONFIRMED", "SKIPPED", "ORDERED"];
export const orderRequestStatuses: OrderRequestStatusValue[] = ["SUGGESTED", "CONFIRMED", "ORDERED", "SKIPPED"];
export const printableOrderRequestStatuses: OrderRequestStatusValue[] = ["DRAFT", "CONFIRMED"];

export const orderRequestStatusLabels: Record<OrderRequestStatusValue, string> = {
  SUGGESTED: "確認待ち",
  DRAFT: "発注予定",
  CONFIRMED: "発注予定",
  SKIPPED: "見送り",
  ORDERED: "納品待ち",
};

export function canChangeOrderRequestQuantity(status: OrderRequestStatusValue, receivedAt: Date | null) {
  return status === "SUGGESTED" || printableOrderRequestStatuses.includes(status) || (status === "ORDERED" && receivedAt === null);
}

export function createEmptyOrderRequestStatusCounts(): Record<OrderRequestStatusValue, number> {
  return Object.fromEntries(allOrderRequestStatuses.map((status) => [status, 0])) as Record<OrderRequestStatusValue, number>;
}
