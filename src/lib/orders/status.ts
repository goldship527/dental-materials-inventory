export type OrderRequestStatusValue = "DRAFT" | "CONFIRMED" | "SKIPPED" | "ORDERED";

export const orderRequestStatuses: OrderRequestStatusValue[] = ["CONFIRMED", "ORDERED", "SKIPPED", "DRAFT"];
export const printableOrderRequestStatuses: OrderRequestStatusValue[] = ["DRAFT", "CONFIRMED"];

export const orderRequestStatusLabels: Record<OrderRequestStatusValue, string> = {
  DRAFT: "確認待ち",
  CONFIRMED: "発注予定",
  SKIPPED: "見送り",
  ORDERED: "発注済み",
};

export function createEmptyOrderRequestStatusCounts(): Record<OrderRequestStatusValue, number> {
  return Object.fromEntries(orderRequestStatuses.map((status) => [status, 0])) as Record<OrderRequestStatusValue, number>;
}
