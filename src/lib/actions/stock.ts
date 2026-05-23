"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActiveClinicContext, requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";

const stockItemIdSchema = z.string().min(1);
const quantitySchema = z.coerce.number().int().min(0).max(9999);
const expectedUpdatedAtSchema = z.coerce.number().int().nonnegative();
const reasonSchema = z.string().trim().min(1, "理由メモを入力してください。").max(200);
const deltaSchema = z.coerce.number().pipe(z.union([z.literal(-1), z.literal(1)]));
const sourceTypeSchema = z.enum(["MANUAL", "STOCKTAKE"]).default("MANUAL");
const stockConflictMessage =
  "他のスタッフが先に在庫を変更しました。最新の在庫を確認してから再度操作してください。";

export type StockActionState = {
  status?: "success" | "error";
  message?: string;
};

type StockUpdateResult = {
  productName: string;
  beforeQuantity: number;
  afterQuantity: number;
};

export type AdjustStockInput = {
  stockItemId: string;
  quantity: number;
  reason: string;
  sourceType: "MANUAL" | "STOCKTAKE";
  expectedQuantity: number | null;
  expectedUpdatedAt: number | null;
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

function parseOptionalQuantity(value: FormDataEntryValue | null) {
  if (value === null || value === "") {
    return null;
  }

  return quantitySchema.parse(value);
}

function parseOptionalUpdatedAt(value: FormDataEntryValue | null) {
  if (value === null || value === "") {
    return null;
  }

  return expectedUpdatedAtSchema.parse(value);
}

function parseAdjustStockInput(formData: FormData): AdjustStockInput {
  return {
    stockItemId: stockItemIdSchema.parse(formData.get("stockItemId")),
    quantity: quantitySchema.parse(formData.get("quantity")),
    reason: reasonSchema.parse(formData.get("reason")),
    sourceType: sourceTypeSchema.parse(formData.get("sourceType") ?? "MANUAL"),
    expectedQuantity: parseOptionalQuantity(formData.get("expectedQuantity")),
    expectedUpdatedAt: parseOptionalUpdatedAt(formData.get("expectedUpdatedAt")),
  };
}

export async function adjustStockForContext(
  context: ActiveClinicContext,
  input: AdjustStockInput,
): Promise<StockUpdateResult> {
  const result = await prisma.$transaction(async (tx) => {
    const stockItem = await tx.stockItem.findFirst({
      where: {
        id: input.stockItemId,
        clinicId: context.clinicId,
        isUsed: true,
      },
      select: {
        id: true,
        productId: true,
        clinicId: true,
        quantity: true,
        updatedAt: true,
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

    if (
      input.expectedQuantity !== null &&
      input.expectedUpdatedAt !== null &&
      (stockItem.quantity !== input.expectedQuantity || stockItem.updatedAt.getTime() !== input.expectedUpdatedAt)
    ) {
      throw new Error(stockConflictMessage);
    }

    const updateResult = await tx.stockItem.updateMany({
      where: {
        id: stockItem.id,
        ...(input.expectedQuantity !== null && input.expectedUpdatedAt !== null
          ? {
              quantity: input.expectedQuantity,
              updatedAt: new Date(input.expectedUpdatedAt),
            }
          : {}),
      },
      data: {
        quantity: input.quantity,
      },
    });

    if (updateResult.count === 0) {
      throw new Error(stockConflictMessage);
    }

    await tx.stockMovement.create({
      data: {
        clinicId: context.clinicId,
        productId: stockItem.productId,
        movementType: "ADJUST",
        quantity: input.quantity - stockItem.quantity,
        beforeQuantity: stockItem.quantity,
        afterQuantity: input.quantity,
        reason: input.reason,
        sourceType: input.sourceType,
        userId: context.userId,
      },
    });

    return {
      productName: stockItem.product.name,
      beforeQuantity: stockItem.quantity,
      afterQuantity: input.quantity,
    };
  });

  return result;
}

async function adjustStock(formData: FormData): Promise<StockUpdateResult> {
  const context = await requireActiveClinic();
  const result = await adjustStockForContext(context, parseAdjustStockInput(formData));

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
        reason: parsedDelta > 0 ? "クイック出庫 +1" : "クイック出庫 -1",
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
