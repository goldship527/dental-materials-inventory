export type OrderRequestStatusValue = "DRAFT" | "CONFIRMED" | "SKIPPED" | "ORDERED";

export const allOrderRequestStatuses: OrderRequestStatusValue[] = ["DRAFT", "CONFIRMED", "SKIPPED", "ORDERED"];
export const orderRequestStatuses: OrderRequestStatusValue[] = ["CONFIRMED", "ORDERED", "SKIPPED"];
export const printableOrderRequestStatuses: OrderRequestStatusValue[] = ["DRAFT", "CONFIRMED"];

export const orderRequestStatusLabels: Record<OrderRequestStatusValue, string> = {
  DRAFT: "発注予定",
  CONFIRMED: "発注予定",
  SKIPPED: "見送り",
  ORDERED: "納品待ち",
};

export function createEmptyOrderRequestStatusCounts(): Record<OrderRequestStatusValue, number> {
  return Object.fromEntries(allOrderRequestStatuses.map((status) => [status, 0])) as Record<OrderRequestStatusValue, number>;
}
