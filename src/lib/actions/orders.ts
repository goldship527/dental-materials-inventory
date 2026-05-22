"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";
import { printableOrderRequestStatuses } from "@/lib/orders/status";
import { orderRequestStatusLabels, type OrderRequestStatusValue } from "@/lib/orders/status";

const orderRequestIdSchema = z.string().min(1);
const orderRequestIdsSchema = z.array(orderRequestIdSchema).min(1);
const stockItemIdSchema = z.string().min(1);
const supplierIdSchema = z.string().min(1);
const requestedQuantitySchema = z.coerce.number().int().min(1).max(9999);
const orderRequestStatusSchema = z.enum(["DRAFT", "CONFIRMED", "SKIPPED", "ORDERED"]);
const orderedConfirmationSchema = z.literal("on");
const receivedQuantitySchema = z.coerce
  .number()
  .int("納品数量は整数で入力してください。")
  .min(1, "納品数量は1以上で入力してください。")
  .max(9999, "納品数量は9999以下で入力してください。");
const receivedMemoSchema = z.string().trim().max(200, "納品メモは200文字以内で入力してください。");
const memoSchema = z.string().trim().max(200, "メモは200文字以内で入力してください。");

export type OrderActionState = {
  status?: "success" | "error";
  message?: string;
};

type ActiveClinicContext = Awaited<ReturnType<typeof requireActiveClinic>>;

function revalidateOrderPages() {
  revalidatePath("/home");
  revalidatePath("/shortage");
  revalidatePath("/orders");
  revalidatePath("/orders/print");
  revalidatePath("/suppliers");
  revalidatePath("/products");
  revalidatePath("/inventory");
  revalidatePath("/quick");
  revalidatePath("/movements");
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
            in: printableOrderRequestStatuses,
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

    const request = await updateOrderRequestStatusForContext(context, {
      orderRequestId,
      status,
      memo,
    });

    const label = orderRequestStatusLabels[status];

    return {
      status: "success",
      message: `${request.productName} を${label}にしました。`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateOrderRequestSupplierWithStateAction(
  _previousState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  try {
    const context = await requireActiveClinic();
    const orderRequestId = orderRequestIdSchema.parse(formData.get("orderRequestId"));
    const supplierId = supplierIdSchema.parse(formData.get("supplierId"));

    const result = await updateOrderRequestSupplierForContext(context, {
      orderRequestId,
      supplierId,
    });

    return {
      status: "success",
      message: `${result.productName} の発注先を ${result.supplierName} に変更しました。`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateOrderRequestStatusForContext(
  context: ActiveClinicContext,
  input: {
    orderRequestId: string;
    status: OrderRequestStatusValue;
    memo: string | null;
    revalidate?: boolean;
  },
) {
  const target = await prisma.orderRequest.findFirst({
    where: {
      id: input.orderRequestId,
      clinicId: context.clinicId,
    },
    select: {
      id: true,
      orderedAt: true,
      receivedAt: true,
      status: true,
    },
  });

  if (!target) {
    throw new Error("対象の発注候補が見つかりません。");
  }

  if (target.receivedAt && input.status !== "ORDERED") {
    throw new Error("納品確認済みの発注候補は、発注済み以外の状態へ戻せません。");
  }

  const request = await prisma.orderRequest.update({
    where: {
      id: target.id,
    },
    data: {
      status: input.status,
      memo: input.memo,
      orderedAt:
        input.status === "ORDERED" ? (target.status === "ORDERED" ? target.orderedAt : new Date()) : null,
    },
    include: {
      product: {
        select: {
          name: true,
        },
      },
    },
  });

  if (input.revalidate ?? true) {
    revalidateOrderPages();
  }

  return {
    productName: request.product.name,
    orderedAt: request.orderedAt,
    status: request.status,
  };
}

export async function updateOrderRequestSupplierForContext(
  context: ActiveClinicContext,
  input: {
    orderRequestId: string;
    supplierId: string;
    revalidate?: boolean;
  },
) {
  const target = await prisma.orderRequest.findFirst({
    where: {
      id: input.orderRequestId,
      clinicId: context.clinicId,
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          organizationId: true,
          primarySupplierId: true,
          productSuppliers: {
            where: {
              supplierId: input.supplierId,
              isActive: true,
            },
            select: {
              supplierId: true,
            },
          },
        },
      },
    },
  });

  if (!target) {
    throw new Error("対象の発注候補が見つかりません。");
  }

  if (!printableOrderRequestStatuses.includes(target.status)) {
    throw new Error("発注先を変更できるのは、未確認または確認済みの発注候補だけです。");
  }

  if (target.product.organizationId !== context.organizationId) {
    throw new Error("対象の商品が見つかりません。");
  }

  const supplier = await prisma.supplier.findFirst({
    where: {
      id: input.supplierId,
      organizationId: context.organizationId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!supplier) {
    throw new Error("対象の発注先が見つかりません。");
  }

  const canUseSupplier =
    target.product.primarySupplierId === supplier.id ||
    target.product.productSuppliers.some((productSupplier) => productSupplier.supplierId === supplier.id);

  if (!canUseSupplier) {
    throw new Error("この商品に登録されていない発注先は選択できません。");
  }

  await prisma.orderRequest.update({
    where: {
      id: target.id,
    },
    data: {
      supplierId: supplier.id,
    },
  });

  if (input.revalidate ?? true) {
    revalidateOrderPages();
  }

  return {
    productName: target.product.name,
    supplierName: supplier.name,
  };
}

export async function receiveOrderRequestWithStateAction(
  _previousState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  try {
    const context = await requireActiveClinic();
    const orderRequestId = orderRequestIdSchema.parse(formData.get("orderRequestId"));
    const receivedQuantity = receivedQuantitySchema.parse(formData.get("receivedQuantity"));
    const receivedMemoValue = receivedMemoSchema.parse(formData.get("receivedMemo") ?? "");
    const applyToStock = formData.get("applyToStock") === "on";

    const result = await receiveOrderRequestForContext(context, {
      orderRequestId,
      receivedQuantity,
      receivedMemo: receivedMemoValue.length > 0 ? receivedMemoValue : null,
      applyToStock,
    });

    return {
      status: "success",
      message: `${result.productName} の納品を確認しました。${result.afterQuantity == null ? "" : `現在庫は ${result.afterQuantity} です。`}`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function receiveOrderRequestForContext(
  context: ActiveClinicContext,
  input: {
    orderRequestId: string;
    receivedQuantity: number;
    receivedMemo: string | null;
    applyToStock: boolean;
    revalidate?: boolean;
  },
) {
  const result = await prisma.$transaction(async (tx) => {
    const target = await tx.orderRequest.findFirst({
      where: {
        id: input.orderRequestId,
        clinicId: context.clinicId,
      },
      select: {
        id: true,
        productId: true,
        requestedQuantity: true,
        status: true,
        receivedAt: true,
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!target) {
      throw new Error("対象の発注候補が見つかりません。");
    }

    if (target.status !== "ORDERED") {
      throw new Error("納品確認できるのは、発注済みの候補だけです。");
    }

    if (target.receivedAt) {
      throw new Error("この発注候補はすでに納品確認済みです。");
    }

    if (input.receivedQuantity > target.requestedQuantity) {
      throw new Error("納品数量は発注数量以下で入力してください。");
    }

    let afterQuantity: number | null = null;

    if (input.applyToStock) {
      const stockItem = await tx.stockItem.findFirst({
        where: {
          clinicId: context.clinicId,
          productId: target.productId,
          isUsed: true,
        },
        select: {
          id: true,
          quantity: true,
        },
      });

      if (!stockItem) {
        throw new Error("対象商品の在庫行が見つかりません。在庫一覧で在庫行を確認してください。");
      }

      const updatedStockItem = await tx.stockItem.update({
        where: {
          id: stockItem.id,
        },
        data: {
          quantity: {
            increment: input.receivedQuantity,
          },
        },
        select: {
          quantity: true,
        },
      });

      afterQuantity = updatedStockItem.quantity;

      await tx.stockMovement.create({
        data: {
          clinicId: context.clinicId,
          productId: target.productId,
          movementType: "IN",
          quantity: input.receivedQuantity,
          beforeQuantity: stockItem.quantity,
          afterQuantity,
          reason: "納品",
          sourceType: "ORDER_RECEIPT",
          sourceId: target.id,
          userId: context.userId,
          memo: input.receivedMemo,
        },
      });
    }

    await tx.orderRequest.update({
      where: {
        id: target.id,
      },
      data: {
        receivedQuantity: input.receivedQuantity,
        receivedAt: new Date(),
        receivedMemo: input.receivedMemo,
        receivedByUserId: context.userId,
      },
    });

    return {
      productName: target.product.name,
      afterQuantity,
    };
  });

  if (input.revalidate ?? true) {
    revalidateOrderPages();
  }

  return result;
}

export async function revertOrderReceiptWithStateAction(
  _previousState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  try {
    const context = await requireActiveClinic();
    const orderRequestId = orderRequestIdSchema.parse(formData.get("orderRequestId"));

    const result = await revertOrderReceiptForContext(context, {
      orderRequestId,
    });

    return {
      status: "success",
      message: `${result.productName} の納品確認を取り消しました。${result.afterQuantity == null ? "" : `現在庫は ${result.afterQuantity} です。`}`,
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function revertOrderReceiptForContext(
  context: ActiveClinicContext,
  input: {
    orderRequestId: string;
    revalidate?: boolean;
  },
) {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-receipt:${input.orderRequestId}`}))`;

    const target = await tx.orderRequest.findFirst({
      where: {
        id: input.orderRequestId,
        clinicId: context.clinicId,
      },
      select: {
        id: true,
        productId: true,
        status: true,
        receivedQuantity: true,
        receivedAt: true,
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!target) {
      throw new Error("対象の発注候補が見つかりません。");
    }

    if (target.status !== "ORDERED") {
      throw new Error("納品確認を取り消せるのは、発注済みの候補だけです。");
    }

    if (!target.receivedAt || target.receivedQuantity == null) {
      throw new Error("この発注候補はまだ納品確認されていません。");
    }

    let afterQuantity: number | null = null;

    const receiptMovement = await tx.stockMovement.findFirst({
      where: {
        clinicId: context.clinicId,
        productId: target.productId,
        sourceType: "ORDER_RECEIPT",
        sourceId: target.id,
        revertedAt: null,
        revertOfId: null,
      },
      select: {
        id: true,
      },
    });

    if (receiptMovement) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock-item:${context.clinicId}:${target.productId}`}))`;

      const stockItem = await tx.stockItem.findFirst({
        where: {
          clinicId: context.clinicId,
          productId: target.productId,
          isUsed: true,
        },
        select: {
          id: true,
          quantity: true,
        },
      });

      if (!stockItem) {
        throw new Error("対象商品の在庫行が見つかりません。在庫一覧で在庫行を確認してください。");
      }

      if (stockItem.quantity < target.receivedQuantity) {
        throw new Error("現在庫が納品確認数より少ないため、在庫反映済みの納品確認を取り消せません。");
      }

      const updatedStockItem = await tx.stockItem.update({
        where: {
          id: stockItem.id,
        },
        data: {
          quantity: {
            decrement: target.receivedQuantity,
          },
        },
        select: {
          quantity: true,
        },
      });

      afterQuantity = updatedStockItem.quantity;

      await tx.stockMovement.create({
        data: {
          clinicId: context.clinicId,
          productId: target.productId,
          movementType: "OUT",
          quantity: -target.receivedQuantity,
          beforeQuantity: stockItem.quantity,
          afterQuantity,
          reason: "納品確認取り消し",
          sourceType: "ORDER_RECEIPT_REVERT",
          sourceId: target.id,
          revertOfId: receiptMovement.id,
          userId: context.userId,
        },
      });

      await tx.stockMovement.update({
        where: {
          id: receiptMovement.id,
        },
        data: {
          revertedAt: new Date(),
          revertedById: context.userId,
        },
      });
    }

    await tx.orderRequest.update({
      where: {
        id: target.id,
      },
      data: {
        receivedQuantity: null,
        receivedAt: null,
        receivedMemo: null,
        receivedByUserId: null,
      },
    });

    return {
      productName: target.product.name,
      afterQuantity,
    };
  });

  if (input.revalidate ?? true) {
    revalidateOrderPages();
  }

  return result;
}

export async function markOrderRequestsOrderedAction(formData: FormData) {
  const context = await requireActiveClinic();
  orderedConfirmationSchema.parse(formData.get("confirmOrdered"));
  const orderRequestIds = orderRequestIdsSchema.parse(formData.getAll("orderRequestId"));

  await prisma.orderRequest.updateMany({
    where: {
      id: {
        in: orderRequestIds,
      },
      clinicId: context.clinicId,
      status: {
        in: printableOrderRequestStatuses,
      },
    },
    data: {
      status: "ORDERED",
      orderedAt: new Date(),
    },
  });

  revalidateOrderPages();
}
