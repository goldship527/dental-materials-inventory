import type { Prisma } from "@prisma/client";
import { z } from "zod";

export type StockOutCard = {
  stockItemId: string;
  productId: string;
  name: string;
  specification: string | null;
  category: string | null;
  orderUnit: string | null;
  quantity: number;
  minStock: number;
  stockUpdatedAt: number;
  stockUsageMode: string;
  photoUpdatedAt: number | null;
  issueHint: string | null;
};

export const cardIssueSchema = z.object({
  stockItemId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1, "出庫数は1以上にしてください。").max(9999),
  expectedQuantity: z.coerce.number().int().nonnegative(),
  expectedUpdatedAt: z.coerce.number().int().nonnegative(),
  expectedUnit: z.string().trim().min(1).max(100),
  unitConfirmed: z.literal("yes", {message: "在庫と同じ単位で出すことを確認してください。"}),
  staffOperatorId: z.string().trim().min(1, "作業スタッフを選択してください。"),
});
export type CardIssueInput = z.infer<typeof cardIssueSchema>;

export class CardIssueError extends Error {}

export function cardStockUnit(value: string | null) {
  const unit = value?.normalize("NFKC").trim();
  return unit && !["つ", "未設定", "不明", "?", "？", "-"].includes(unit) ? unit : null;
}

export function cardIssueBlockReason(card: Pick<StockOutCard, "orderUnit" | "quantity" | "stockUsageMode">) {
  if (!cardStockUnit(card.orderUnit)) return "単位の確認が必要です";
  if (card.stockUsageMode !== "NONE") return "使用中管理は商品詳細で操作します";
  if (card.quantity <= 0) return "在庫がありません";
  return null;
}

export function filterStockOutCards(cards: StockOutCard[], query: string, category: string | null) {
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ja-JP")
    .replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return cards.filter(card => (!category || (card.category || "未分類") === category) &&
    terms.every(term => normalize([card.name, card.specification, card.category].filter(Boolean).join(" ")).includes(term)));
}

// Called only inside the authenticated action's transaction. No direct server-action export.
export async function issueFromCard(
  tx: Prisma.TransactionClient,
  context: {clinicId: string; organizationId: string; userId: string},
  rawInput: CardIssueInput,
) {
  const input = cardIssueSchema.parse(rawInput);
  const staff = await tx.staffOperator.findFirst({
    where: {id: input.staffOperatorId, organizationId: context.organizationId, isActive: true,
      clinicAssignments: {some: {clinicId: context.clinicId, clinic: {isActive: true}}}},
    select: {id: true},
  });
  if (!staff) throw new CardIssueError("このクリニックで有効な作業スタッフを選択してください。");
  const scope = {id: input.stockItemId, clinicId: context.clinicId, isUsed: true,
    product: {organizationId: context.organizationId, isActive: true}};
  const stock = await tx.stockItem.findFirst({
    where: scope,
    select: {id: true, productId: true, quantity: true, updatedAt: true,
      product: {select: {name: true, orderUnit: true, stockUsageMode: true}}},
  });
  if (!stock) throw new CardIssueError("対象の在庫が見つかりません。一覧を更新してください。");
  const unit = cardStockUnit(stock.product.orderUnit);
  const block = cardIssueBlockReason({...stock.product, quantity: stock.quantity});
  if (block) throw new CardIssueError(block);
  const conflict = "在庫または単位が変更されています。一覧を更新して選び直してください。";
  if (stock.quantity !== input.expectedQuantity || stock.updatedAt.getTime() !== input.expectedUpdatedAt || unit !== input.expectedUnit) {
    throw new CardIssueError(conflict);
  }
  if (input.quantity > stock.quantity) throw new CardIssueError("現在庫より多く出庫することはできません。");
  const updated = await tx.stockItem.updateMany({
    where: {...scope, quantity: input.expectedQuantity, updatedAt: new Date(input.expectedUpdatedAt),
      product: {...scope.product, orderUnit: stock.product.orderUnit, stockUsageMode: "NONE"}},
    data: {quantity: {decrement: input.quantity}},
  });
  if (updated.count !== 1) throw new CardIssueError(conflict);
  const afterQuantity = stock.quantity - input.quantity;
  await tx.stockMovement.create({data: {
    clinicId: context.clinicId, productId: stock.productId, movementType: "OUT",
    quantity: -input.quantity, beforeQuantity: stock.quantity, afterQuantity,
    reason: `カード出庫: ${input.quantity}${unit}（在庫と同じ単位・換算なし）`,
    sourceType: "QUICK_CARD", userId: context.userId, performedByStaffId: staff.id,
  }});
  return {productId: stock.productId, productName: stock.product.name, afterQuantity, unit};
}
