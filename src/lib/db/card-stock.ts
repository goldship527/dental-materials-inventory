import type { PrismaClient } from "@prisma/client";
import type { StockOutCard } from "@/lib/stock/card-issue";

export async function getCardStockRows(db: Pick<PrismaClient, "stockItem">, context: {clinicId: string; organizationId: string}): Promise<StockOutCard[]> {
  const items = await db.stockItem.findMany({
    where: {clinicId: context.clinicId, isUsed: true, product: {organizationId: context.organizationId, isActive: true}},
    select: {id: true, productId: true, quantity: true, minStock: true, updatedAt: true,
      product: {select: {name: true, specification: true, category: true, orderUnit: true,
        defaultMinStock: true, stockUsageMode: true, photoUpdatedAt: true, notes: true}}},
    orderBy: [{product: {category: "asc"}}, {product: {name: "asc"}}, {id: "asc"}],
  });
  return items.map(item => ({
    stockItemId: item.id, productId: item.productId, name: item.product.name,
    specification: item.product.specification, category: item.product.category,
    orderUnit: item.product.orderUnit, quantity: item.quantity,
    minStock: item.minStock ?? item.product.defaultMinStock,
    stockUpdatedAt: item.updatedAt.getTime(), stockUsageMode: item.product.stockUsageMode,
    photoUpdatedAt: item.product.photoUpdatedAt?.getTime() ?? null,
    issueHint: item.product.notes?.match(/^元表の出し方: (.*)$/m)?.[1]?.trim() || null,
  }));
}
