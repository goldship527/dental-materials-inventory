"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { analyzeBarcodeInput } from "@/lib/barcode/gs1";
import { isAllowedBarcodeStockReason } from "@/lib/barcode/stock-reasons";
import { searchProductsByBarcode } from "@/lib/db/barcodes";
import { requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";
import { findActiveStaffOperatorForClinic } from "@/lib/db/staff-operators";

const movementTypeSchema = z.enum(["IN", "OUT"]);
const quantitySchema = z.coerce
  .number()
  .int("数量は整数で入力してください。")
  .min(1, "数量は1以上で入力してください。")
  .max(9999, "数量は9999以下で入力してください。");
const barcodeSchema = z.string().trim().min(1, "バーコードを読み取ってください。").max(300, "バーコードが長すぎます。");
const staffBarcodeSchema = z.string().trim().min(1, "担当者バーコードを読み取ってください。").max(64, "担当者バーコードが長すぎます。");
const productIdSchema = z.string().min(1, "商品を選択してください。");
const reasonSchema = z.string().trim().min(1, "理由を選択してください。").max(40, "理由が長すぎます。");
const reasonNoteSchema = z.string().trim().max(160, "補足メモは160文字以内で入力してください。");

export type BarcodeStockActionState = {
  status?: "success" | "error";
  message?: string;
  afterQuantity?: number;
};

type BarcodeStockMoveContext = {
  userId: string;
  organizationId: string;
  clinicId: string;
};

type BarcodeStockMoveInput = {
  staffBarcode: string;
  barcode: string;
  productId: string;
  movementType: "IN" | "OUT";
  quantity: number;
  reason: string;
  reasonNote: string;
};

function buildReason(reason: string, note: string) {
  return note ? `${reason}: ${note}` : reason;
}

function normalizeLotText(value: string | null) {
  const normalized = value?.trim() ?? "";

  return normalized.slice(0, 120);
}

function buildLotData(barcode: string) {
  const analysis = analyzeBarcodeInput(barcode);
  const lotNumber = normalizeLotText(analysis.lotNumber);
  const expiryDateText = normalizeLotText(analysis.expiryDateText);

  if (!lotNumber && !expiryDateText) {
    return null;
  }

  return {
    lotNumber,
    expiryDateText,
    expiryDate: analysis.expiryDate,
  };
}

function revalidateBarcodeStockPages() {
  revalidatePath("/barcode/stock");
  revalidatePath("/home");
  revalidatePath("/inventory");
  revalidatePath("/quick");
  revalidatePath("/shortage");
  revalidatePath("/movements");
  revalidatePath("/products");
}

function toActionError(error: unknown): BarcodeStockActionState {
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
    message: "バーコード出入庫を確定できませんでした。",
  };
}

async function applyStockLotMove(
  tx: Prisma.TransactionClient,
  options: {
    clinicId: string;
    productId: string;
    movementType: "IN" | "OUT";
    quantity: number;
    lotData: NonNullable<ReturnType<typeof buildLotData>>;
  },
) {
  const lot = await tx.stockLot.findFirst({
    where: {
      clinicId: options.clinicId,
      productId: options.productId,
      lotNumber: options.lotData.lotNumber,
      expiryDateText: options.lotData.expiryDateText,
    },
    select: {
      id: true,
      quantity: true,
    },
  });

  if (options.movementType === "OUT") {
    if (!lot || lot.quantity < options.quantity) {
      throw new Error("指定ロットの在庫が不足しているため、ロット指定出庫はできません。");
    }

    await tx.stockLot.update({
      where: {
        id: lot.id,
      },
      data: {
        quantity: {
          decrement: options.quantity,
        },
        expiryDate: options.lotData.expiryDate,
      },
    });

    return;
  }

  if (lot) {
    await tx.stockLot.update({
      where: {
        id: lot.id,
      },
      data: {
        quantity: {
          increment: options.quantity,
        },
        expiryDate: options.lotData.expiryDate,
      },
    });

    return;
  }

  await tx.stockLot.create({
    data: {
      clinicId: options.clinicId,
      productId: options.productId,
      lotNumber: options.lotData.lotNumber,
      expiryDateText: options.lotData.expiryDateText,
      expiryDate: options.lotData.expiryDate,
      quantity: options.quantity,
    },
  });
}

export async function barcodeStockMoveForContext(options: {
  context: BarcodeStockMoveContext;
  input: BarcodeStockMoveInput;
  revalidate?: boolean;
}): Promise<{
  productName: string;
  afterQuantity: number;
}> {
  const { context, input } = options;
  const { staffBarcode, barcode, productId, movementType, quantity, reason, reasonNote } = input;

  if (!isAllowedBarcodeStockReason(movementType, reason)) {
    throw new Error("選択した入出庫区分に対応した理由を選んでください。");
  }

  const matches = await searchProductsByBarcode(context.clinicId, barcode);

  if (matches.length !== 1) {
    throw new Error("商品が1件に特定できないため、在庫は変更しません。");
  }

  const match = matches[0];

  if (match.productId !== productId) {
    throw new Error("読み取り結果の商品と操作対象の商品が一致しません。もう一度読み取ってください。");
  }

  const staffOperator = await findActiveStaffOperatorForClinic({
    organizationId: context.organizationId,
    clinicId: context.clinicId,
    barcode: staffBarcode,
  });

  if (!staffOperator) {
    throw new Error("有効な担当者バーコードが見つかりません。このクリニックで使える担当者を確認してください。");
  }

  const reasonText = buildReason(reason, reasonNote);
  const signedQuantity = movementType === "OUT" ? -quantity : quantity;
  const memo = `読み取りバーコード: ${barcode}`;
  const lotData = buildLotData(barcode);

  const result = await prisma.$transaction(async (tx) => {
    const stockItem = await tx.stockItem.findFirst({
      where: {
        id: match.stockItemId,
        clinicId: context.clinicId,
        productId,
        isUsed: true,
        product: {
          isActive: true,
        },
      },
      select: {
        id: true,
        productId: true,
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

    if (movementType === "OUT") {
      const updateResult = await tx.stockItem.updateMany({
        where: {
          id: stockItem.id,
          quantity: {
            gte: quantity,
          },
        },
        data: {
          quantity: {
            decrement: quantity,
          },
        },
      });

      if (updateResult.count === 0) {
        throw new Error("現在庫を超える数量は出庫できません。");
      }
    } else {
      await tx.stockItem.update({
        where: {
          id: stockItem.id,
        },
        data: {
          quantity: {
            increment: quantity,
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

    const beforeQuantity = movementType === "OUT" ? updatedStockItem.quantity + quantity : updatedStockItem.quantity - quantity;

    if (lotData) {
      await applyStockLotMove(tx, {
        clinicId: context.clinicId,
        productId: stockItem.productId,
        movementType,
        quantity,
        lotData,
      });
    }

    await tx.stockMovement.create({
      data: {
        clinicId: context.clinicId,
        productId: stockItem.productId,
        movementType,
        quantity: signedQuantity,
        beforeQuantity,
        afterQuantity: updatedStockItem.quantity,
        reason: reasonText,
        sourceType: "BARCODE_STOCK",
        lotNumber: lotData?.lotNumber || null,
        expiryDateText: lotData?.expiryDateText || null,
        expiryDate: lotData?.expiryDate ?? null,
        userId: context.userId,
        performedByStaffId: staffOperator.id,
        memo,
      },
    });

    return {
      productName: stockItem.product.name,
      afterQuantity: updatedStockItem.quantity,
    };
  });

  if (options.revalidate ?? true) {
    revalidateBarcodeStockPages();
  }

  return result;
}

export async function barcodeStockMoveAction(
  _previousState: BarcodeStockActionState,
  formData: FormData,
): Promise<BarcodeStockActionState> {
  try {
    const context = await requireActiveClinic();
    const staffBarcode = staffBarcodeSchema.parse(formData.get("staffBarcode"));
    const barcode = barcodeSchema.parse(formData.get("barcode"));
    const productId = productIdSchema.parse(formData.get("productId"));
    const movementType = movementTypeSchema.parse(formData.get("movementType"));
    const quantity = quantitySchema.parse(formData.get("quantity"));
    const reason = reasonSchema.parse(formData.get("reason"));
    const reasonNote = reasonNoteSchema.parse(formData.get("reasonNote") ?? "");

    const result = await barcodeStockMoveForContext({
      context,
      input: {
        staffBarcode,
        barcode,
        productId,
        movementType,
        quantity,
        reason,
        reasonNote,
      },
    });

    return {
      status: "success",
      message: `${result.productName} を${movementType === "OUT" ? "出庫" : "入庫"}しました。現在庫は ${result.afterQuantity} です。`,
      afterQuantity: result.afterQuantity,
    };
  } catch (error) {
    return toActionError(error);
  }
}
