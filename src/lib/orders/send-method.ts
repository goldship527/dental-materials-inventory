export const orderSendMethodValues = ["FAX", "EMAIL", "PHONE", "LINE"] as const;

export type OrderSendMethodValue = (typeof orderSendMethodValues)[number];

export const orderSendMethodLabels: Record<OrderSendMethodValue, string> = {
  FAX: "FAX",
  EMAIL: "メール",
  PHONE: "電話",
  LINE: "LINE",
};
