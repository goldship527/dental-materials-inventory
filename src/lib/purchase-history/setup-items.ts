import { z } from "zod";

const setupItemSchema = z.object({
  productId: z.string().min(1),
  category: z
    .string()
    .trim()
    .max(100, "カテゴリは100文字以内で入力してください。")
    .transform((value) => (value.length > 0 ? value : null)),
  defaultMinStock: z.coerce
    .number()
    .int("最低在庫は整数で入力してください。")
    .min(0, "最低在庫は0以上で入力してください。")
    .max(9999, "最低在庫は9999以下で入力してください。"),
});

const setupItemsSchema = z.array(setupItemSchema).max(200, "一度に更新できる商品は200件までです。");
const setupItemsReadError = "一括整備の入力内容を読み取れませんでした。もう一度画面を開き直してください。";

export type PurchaseHistorySetupInput = z.infer<typeof setupItemSchema>;

export function parsePurchaseHistorySetupItemsJson(rawValue: string): PurchaseHistorySetupInput[] {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmedValue);
  } catch {
    throw new Error(setupItemsReadError);
  }

  return setupItemsSchema.parse(parsed);
}
