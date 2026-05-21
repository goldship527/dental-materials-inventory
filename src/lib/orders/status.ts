export type OrderRequestStatusValue = "DRAFT" | "CONFIRMED" | "SKIPPED" | "ORDERED";

export const orderRequestStatuses: OrderRequestStatusValue[] = ["DRAFT", "CONFIRMED", "SKIPPED", "ORDERED"];
export const printableOrderRequestStatuses: OrderRequestStatusValue[] = ["DRAFT", "CONFIRMED"];

export const orderRequestStatusLabels: Record<OrderRequestStatusValue, string> = {
  DRAFT: "未確認",
  CONFIRMED: "確認済み",
  SKIPPED: "取り消し",
  ORDERED: "発注済み",
};

export function createEmptyOrderRequestStatusCounts(): Record<OrderRequestStatusValue, number> {
  return Object.fromEntries(orderRequestStatuses.map((status) => [status, 0])) as Record<OrderRequestStatusValue, number>;
}
