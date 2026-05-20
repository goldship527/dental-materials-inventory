"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { searchProductsByBarcode } from "@/lib/db/barcodes";
import { requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";

const movementTypeSchema = z.enum(["IN", "OUT"]);
const quantitySchema = z.coerce.number().int("数量は整数で入力してください。").min(1, "数量は1以上で入力してください。").max(9999, "数量は9999以下で入力してください。");
const barcodeSchema = z.string().trim().min(1, "バーコードを読み取ってください。").max(300, "バーコードが長すぎます。");
const productIdSchema = z.string().min(1, "商品を選択してください。");
const reasonSchema = z.string().trim().min(1, "理由を選択してください。").max(40, "理由が長すぎます。");
const reasonNoteSchema = z.string().trim().max(160, "補足メモは160文字以内で入力してください。");

const outReasons = new Set(["使用", "棚卸調整", "その他"]);
const inReasons = new Set(["納品", "返品戻り", "棚卸調整", "その他"]);

export type BarcodeStockActionState = {
  status?: "success" | "error";
  message?: string;
  afterQuantity?: number;
};

function buildReason(reason: string, note: string) {
  return note ? `${reason}: ${note}` : reason;
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

export async function barcodeStockMoveAction(
  _previousState: BarcodeStockActionState,
  formData: FormData,
): Promise<BarcodeStockActionState> {
  try {
    const context = await requireActiveClinic();
    const barcode = barcodeSchema.parse(formData.get("barcode"));
    const productId = productIdSchema.parse(formData.get("productId"));
    const movementType = movementTypeSchema.parse(formData.get("movementType"));
    const quantity = quantitySchema.parse(formData.get("quantity"));
    const reason = reasonSchema.parse(formData.get("reason"));
    const reasonNote = reasonNoteSchema.parse(formData.get("reasonNote") ?? "");
    const allowedReasons = movementType === "OUT" ? outReasons : inReasons;

    if (!allowedReasons.has(reason)) {
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

    const reasonText = buildReason(reason, reasonNote);
    const signedQuantity = movementType === "OUT" ? -quantity : quantity;
    const memo = `読み取りバーコード: ${barcode}`;

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
          userId: context.userId,
          memo,
        },
      });

      return {
        productName: stockItem.product.name,
        afterQuantity: updatedStockItem.quantity,
      };
    });

    revalidateBarcodeStockPages();

    return {
      status: "success",
      message: `${result.productName} を${movementType === "OUT" ? "出庫" : "入庫"}しました。現在庫は ${result.afterQuantity} です。`,
      afterQuantity: result.afterQuantity,
    };
  } catch (error) {
    return toActionError(error);
  }
}
