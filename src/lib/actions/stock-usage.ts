"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActiveClinicContext, requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";
import { findActiveStaffOperatorByIdForClinic } from "@/lib/db/staff-operators";
import { stockUsageModes } from "@/lib/stock/usage-mode";

const stockItemIdSchema = z.string().min(1);
const staffOperatorIdSchema = z.string().trim().min(1, "作業スタッフを選択してください。");
const quantitySchema = z.coerce.number().int("数量は整数で入力してください。").min(1, "数量は1以上で入力してください。").max(9999);
const operationSchema = z.enum(["START_USE", "END_USE", "DISCARD"]);
const discardFromSchema = z.enum(["AVAILABLE", "IN_USE"]).default("AVAILABLE");
const memoSchema = z
  .string()
  .trim()
  .max(200, "メモは200文字以内で入力してください。")
  .transform((value) => (value.length > 0 ? value : null));

export type StockUsageActionState = {
  status?: "success" | "error";
  message?: string;
};

type StockUsageInput = {
  stockItemId: string;
  operation: "START_USE" | "END_USE" | "DISCARD";
  discardFrom: "AVAILABLE" | "IN_USE";
  quantity: number;
  memo: string | null;
  staffOperatorId: string;
};

function revalidateStockUsagePages(productId: string) {
  revalidatePath("/home");
  revalidatePath("/inventory");
  revalidatePath("/inventory/dormant");
  revalidatePath("/quick");
  revalidatePath("/shortage");
  revalidatePath("/movements");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  revalidatePath(`/products/${productId}/edit`);
}

function parseStockUsageInput(formData: FormData): StockUsageInput {
  return {
    stockItemId: stockItemIdSchema.parse(formData.get("stockItemId")),
    operation: operationSchema.parse(formData.get("operation")),
    discardFrom: discardFromSchema.parse(formData.get("discardFrom") ?? "AVAILABLE"),
    quantity: quantitySchema.parse(formData.get("quantity")),
    memo: memoSchema.parse(formData.get("memo") ?? ""),
    staffOperatorId: staffOperatorIdSchema.parse(formData.get("staffOperatorId")),
  };
}

function getOperationReason(input: StockUsageInput) {
  if (input.operation === "START_USE") {
    return "使用開始";
  }

  if (input.operation === "END_USE") {
    return "使用終了";
  }

  return input.discardFrom === "IN_USE" ? "廃棄（使用中から）" : "廃棄（使用可能から）";
}

async function moveStockUsageForContext(context: ActiveClinicContext, input: StockUsageInput) {
  const staffOperator = await findActiveStaffOperatorByIdForClinic({
    organizationId: context.organizationId,
    clinicId: context.clinicId,
    staffOperatorId: input.staffOperatorId,
  });

  if (!staffOperator) {
    throw new Error("このクリニックで有効な作業スタッフを選択してください。");
  }

  return prisma.$transaction(async (tx) => {
    const stockItem = await tx.stockItem.findFirst({
      where: {
        id: input.stockItemId,
        clinicId: context.clinicId,
        isUsed: true,
        product: {
          organizationId: context.organizationId,
          isActive: true,
        },
      },
      select: {
        id: true,
        productId: true,
        quantity: true,
        inUseQuantity: true,
        discardedQuantity: true,
        product: {
          select: {
            name: true,
            stockUsageMode: true,
          },
        },
      },
    });

    if (!stockItem) {
      throw new Error("対象の在庫が見つかりません。");
    }

    if (stockItem.product.stockUsageMode !== stockUsageModes.inUse) {
      throw new Error("この商品は使用中管理の対象ではありません。");
    }

    const beforeAvailable = stockItem.quantity;
    const beforeInUse = stockItem.inUseQuantity;
    const beforeDiscarded = stockItem.discardedQuantity;
    let afterAvailable = beforeAvailable;
    let afterInUse = beforeInUse;
    let afterDiscarded = beforeDiscarded;
    let signedQuantity = 0;

    if (input.operation === "START_USE") {
      if (beforeAvailable < input.quantity) {
        throw new Error("使用可能数が不足しています。");
      }

      afterAvailable -= input.quantity;
      afterInUse += input.quantity;
      signedQuantity = -input.quantity;
    }

    if (input.operation === "END_USE") {
      if (beforeInUse < input.quantity) {
        throw new Error("使用中数が不足しています。");
      }

      afterInUse -= input.quantity;
      afterAvailable += input.quantity;
      signedQuantity = input.quantity;
    }

    if (input.operation === "DISCARD") {
      if (input.discardFrom === "IN_USE") {
        if (beforeInUse < input.quantity) {
          throw new Error("使用中数が不足しています。");
        }

        afterInUse -= input.quantity;
      } else {
        if (beforeAvailable < input.quantity) {
          throw new Error("使用可能数が不足しています。");
        }

        afterAvailable -= input.quantity;
      }

      afterDiscarded += input.quantity;
      signedQuantity = -input.quantity;
    }

    await tx.stockItem.update({
      where: {
        id: stockItem.id,
      },
      data: {
        quantity: afterAvailable,
        inUseQuantity: afterInUse,
        discardedQuantity: afterDiscarded,
      },
    });

    await tx.stockMovement.create({
      data: {
        clinicId: context.clinicId,
        productId: stockItem.productId,
        movementType: input.operation,
        quantity: signedQuantity,
        beforeQuantity: beforeAvailable,
        afterQuantity: afterAvailable,
        reason: getOperationReason(input),
        sourceType: "STOCK_USAGE",
        userId: context.userId,
        performedByStaffId: staffOperator.id,
        memo: input.memo,
      },
    });

    return {
      productId: stockItem.productId,
      productName: stockItem.product.name,
      available: afterAvailable,
      inUse: afterInUse,
      discarded: afterDiscarded,
    };
  });
}

function toActionError(error: unknown): StockUsageActionState {
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
    message: "使用中管理を更新できませんでした。",
  };
}

export async function moveStockUsageWithStateAction(
  _previousState: StockUsageActionState,
  formData: FormData,
): Promise<StockUsageActionState> {
  try {
    const context = await requireActiveClinic();
    const result = await moveStockUsageForContext(context, parseStockUsageInput(formData));

    revalidateStockUsagePages(result.productId);

    return {
      status: "success",
      message: `${result.productName} を更新しました。使用可能 ${result.available} / 使用中 ${result.inUse} / 廃棄済み累計 ${result.discarded}`,
    };
  } catch (error) {
    return toActionError(error);
  }
}
