"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";

const orderRequestIdSchema = z.string().min(1);
const stockItemIdSchema = z.string().min(1);
const requestedQuantitySchema = z.coerce.number().int().min(1).max(9999);
const orderRequestStatusSchema = z.union([z.literal("DRAFT"), z.literal("CONFIRMED"), z.literal("SKIPPED")]);
const memoSchema = z.string().trim().max(200, "メモは200文字以内で入力してください。");

export type OrderActionState = {
  status?: "success" | "error";
  message?: string;
};

function revalidateOrderPages() {
  revalidatePath("/home");
  revalidatePath("/shortage");
  revalidatePath("/orders");
}

function toActionError(error: unknown): OrderActionState {
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
    message: "発注候補を更新できませんでした。",
  };
}

export async function createOrderRequestWithStateAction(
  _previousState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  try {
    const context = await requireActiveClinic();
    const stockItemId = stockItemIdSchema.parse(formData.get("stockItemId"));

    const result = await prisma.$transaction(async (tx) => {
      const stockItem = await tx.stockItem.findFirst({
        where: {
          id: stockItemId,
          clinicId: context.clinicId,
          isUsed: true,
          product: {
            isActive: true,
          },
        },
        select: {
          quantity: true,
          minStock: true,
          product: {
            select: {
              id: true,
              name: true,
              defaultMinStock: true,
              primarySupplierId: true,
            },
          },
        },
      });

      if (!stockItem) {
        throw new Error("対象の在庫が見つかりません。");
      }

      const activeRequest = await tx.orderRequest.findFirst({
        where: {
          clinicId: context.clinicId,
          productId: stockItem.product.id,
          status: {
            in: ["DRAFT", "CONFIRMED"],
          },
        },
      });

      if (activeRequest) {
        return {
          productName: stockItem.product.name,
          alreadyExists: true,
        };
      }

      const minStock = stockItem.minStock ?? stockItem.product.defaultMinStock;
      const requestedQuantity = Math.max(1, minStock - stockItem.quantity);
      const skippedRequest = await tx.orderRequest.findFirst({
        where: {
          clinicId: context.clinicId,
          productId: stockItem.product.id,
          status: "SKIPPED",
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      if (skippedRequest) {
        await tx.orderRequest.update({
          where: {
            id: skippedRequest.id,
          },
          data: {
            status: "DRAFT",
            requestedQuantity,
            supplierId: stockItem.product.primarySupplierId,
            memo: null,
            createdByUserId: context.userId,
          },
        });
      } else {
        await tx.orderRequest.create({
          data: {
            clinicId: context.clinicId,
            productId: stockItem.product.id,
            supplierId: stockItem.product.primarySupplierId,
            requestedQuantity,
            createdByUserId: context.userId,
          },
        });
      }

      return {
        productName: stockItem.product.name,
        alreadyExists: false,
      };
    });

    revalidateOrderPages();

    return {
      status: "success",
      message: result.alreadyExists
        ? `${result.productName} はすでに発注候補に入っています。`
        : `${result.productName} を発注候補へ追加しました。`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateOrderRequestQuantityWithStateAction(
  _previousState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  try {
    const context = await requireActiveClinic();
    const orderRequestId = orderRequestIdSchema.parse(formData.get("orderRequestId"));
    const requestedQuantity = requestedQuantitySchema.parse(formData.get("requestedQuantity"));

    const request = await prisma.orderRequest.update({
      where: {
        id: orderRequestId,
        clinicId: context.clinicId,
      },
      data: {
        requestedQuantity,
      },
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    revalidateOrderPages();

    return {
      status: "success",
      message: `${request.product.name} の発注数量を ${requestedQuantity} に更新しました。`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateOrderRequestStatusWithStateAction(
  _previousState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  try {
    const context = await requireActiveClinic();
    const orderRequestId = orderRequestIdSchema.parse(formData.get("orderRequestId"));
    const status = orderRequestStatusSchema.parse(formData.get("status"));
    const memoValue = memoSchema.parse(formData.get("memo") ?? "");
    const memo = memoValue.length > 0 ? memoValue : null;

    const request = await prisma.orderRequest.update({
      where: {
        id: orderRequestId,
        clinicId: context.clinicId,
      },
      data: {
        status,
        memo,
      },
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    revalidateOrderPages();

    const label = status === "DRAFT" ? "未確認" : status === "CONFIRMED" ? "確認済み" : "見送り";

    return {
      status: "success",
      message: `${request.product.name} を${label}にしました。`,
    };
  } catch (error) {
    return toActionError(error);
  }
}
