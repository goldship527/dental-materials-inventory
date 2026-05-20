"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";

const stockItemIdSchema = z.string().min(1);
const quantitySchema = z.coerce.number().int().min(0).max(9999);
const reasonSchema = z.string().trim().min(1, "理由メモを入力してください。").max(200);
const deltaSchema = z.coerce.number().pipe(z.union([z.literal(-1), z.literal(1)]));
const sourceTypeSchema = z.enum(["MANUAL", "STOCKTAKE"]).default("MANUAL");

export type StockActionState = {
  status?: "success" | "error";
  message?: string;
};

type StockUpdateResult = {
  productName: string;
  beforeQuantity: number;
  afterQuantity: number;
};

function revalidateStockPages() {
  revalidatePath("/home");
  revalidatePath("/inventory");
  revalidatePath("/quick");
  revalidatePath("/shortage");
  revalidatePath("/movements");
  revalidatePath("/stocktake");
}

function toActionError(error: unknown): StockActionState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: error.issues[0]?.message ?? "入力内容を確認してください。",
    };
  }

  if (error instanceof Error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  return {
    status: "error",
    message: "在庫を更新できませんでした。",
  };
}

async function adjustStock(formData: FormData): Promise<StockUpdateResult> {
  const context = await requireActiveClinic();
  const stockItemId = stockItemIdSchema.parse(formData.get("stockItemId"));
  const newQuantity = quantitySchema.parse(formData.get("quantity"));
  const reason = reasonSchema.parse(formData.get("reason"));
  const sourceType = sourceTypeSchema.parse(formData.get("sourceType") ?? "MANUAL");

  const result = await prisma.$transaction(async (tx) => {
    const stockItem = await tx.stockItem.findFirst({
      where: {
        id: stockItemId,
        clinicId: context.clinicId,
        isUsed: true,
      },
      select: {
        id: true,
        productId: true,
        clinicId: true,
        quantity: true,
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!stockItem) {
      throw new Error("対象の在庫が見つかりません。");
    }

    await tx.stockItem.update({
      where: {
        id: stockItem.id,
      },
      data: {
        quantity: newQuantity,
      },
    });

    await tx.stockMovement.create({
      data: {
        clinicId: context.clinicId,
        productId: stockItem.productId,
        movementType: "ADJUST",
        quantity: newQuantity - stockItem.quantity,
        beforeQuantity: stockItem.quantity,
        afterQuantity: newQuantity,
        reason,
        sourceType,
        userId: context.userId,
      },
    });

    return {
      productName: stockItem.product.name,
      beforeQuantity: stockItem.quantity,
      afterQuantity: newQuantity,
    };
  });

  revalidateStockPages();

  return result;
}

async function quickMove(stockItemId: string, delta: number): Promise<StockUpdateResult> {
  const context = await requireActiveClinic();
  const parsedStockItemId = stockItemIdSchema.parse(stockItemId);
  const parsedDelta = deltaSchema.parse(delta);

  const result = await prisma.$transaction(async (tx) => {
    const stockItem = await tx.stockItem.findFirst({
      where: {
        id: parsedStockItemId,
        clinicId: context.clinicId,
        isUsed: true,
      },
      select: {
        id: true,
        productId: true,
        clinicId: true,
        quantity: true,
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!stockItem) {
      throw new Error("対象の在庫が見つかりません。");
    }

    if (parsedDelta < 0) {
      const updateResult = await tx.stockItem.updateMany({
        where: {
          id: stockItem.id,
          quantity: {
            gt: 0,
          },
        },
        data: {
          quantity: {
            decrement: 1,
          },
        },
      });

      if (updateResult.count === 0) {
        throw new Error("在庫数は0未満にできません。");
      }
    } else {
      await tx.stockItem.update({
        where: {
          id: stockItem.id,
        },
        data: {
          quantity: {
            increment: 1,
          },
        },
      });
    }

    const updatedStockItem = await tx.stockItem.findUniqueOrThrow({
      where: {
        id: stockItem.id,
      },
      select: {
        quantity: true,
      },
    });
    const beforeQuantity = updatedStockItem.quantity - parsedDelta;

    await tx.stockMovement.create({
      data: {
        clinicId: context.clinicId,
        productId: stockItem.productId,
        movementType: parsedDelta > 0 ? "IN" : "OUT",
        quantity: parsedDelta,
        beforeQuantity,
        afterQuantity: updatedStockItem.quantity,
        reason: parsedDelta > 0 ? "よく使うカード +1" : "よく使うカード -1",
        sourceType: "QUICK_CARD",
        userId: context.userId,
      },
    });

    return {
      productName: stockItem.product.name,
      beforeQuantity,
      afterQuantity: updatedStockItem.quantity,
    };
  });

  revalidateStockPages();

  return result;
}

export async function adjustStockAction(formData: FormData) {
  await adjustStock(formData);
}

export async function adjustStockWithStateAction(
  _previousState: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  try {
    const result = await adjustStock(formData);

    return {
      status: "success",
      message: `${result.productName} を ${result.beforeQuantity} → ${result.afterQuantity} に更新しました。`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function quickMoveAction(stockItemId: string, delta: number) {
  await quickMove(stockItemId, delta);
}

export async function quickMoveWithStateAction(
  _previousState: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  try {
    const stockItemId = stockItemIdSchema.parse(formData.get("stockItemId"));
    const delta = deltaSchema.parse(formData.get("delta"));
    const result = await quickMove(stockItemId, delta);
    const label = delta > 0 ? "+1" : "-1";

    return {
      status: "success",
      message: `${result.productName} を${label}しました。現在庫は ${result.afterQuantity} です。`,
    };
  } catch (error) {
    return toActionError(error);
  }
}
