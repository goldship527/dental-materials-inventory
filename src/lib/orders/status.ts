export type OrderRequestStatusValue = "DRAFT" | "CONFIRMED" | "SKIPPED";

export const orderRequestStatusLabels: Record<OrderRequestStatusValue, string> = {
  DRAFT: "未確認",
  CONFIRMED: "確認済み",
  SKIPPED: "取り消し",
};
