"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";
import { cardIssueSchema, CardIssueError, issueFromCard } from "@/lib/stock/card-issue";

export type CardIssueResult = {status: "success" | "error"; message: string};

export async function issueStockCardAction(formData: FormData): Promise<CardIssueResult> {
  const context = await requireActiveClinic();
  try {
    const input = cardIssueSchema.parse(Object.fromEntries(formData));
    const result = await prisma.$transaction(tx => issueFromCard(tx, context, input));
    for (const route of ["/stock-out", "/quick", "/home", "/inventory", "/shortage", "/movements", "/products", `/products/${result.productId}`]) {
      revalidatePath(route);
    }
    return {status: "success", message: `${result.productName} を${input.quantity}${result.unit}出庫しました。残りは${result.afterQuantity}${result.unit}です。`};
  } catch (error) {
    return {status: "error", message: error instanceof CardIssueError ? error.message :
      error instanceof z.ZodError ? error.issues[0]?.message || "入力内容を確認してください。" :
      "出庫結果を確認できませんでした。履歴と最新の在庫を確認してから操作してください。"};
  }
}
