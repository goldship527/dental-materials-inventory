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
      status: true,
    },
  });

  if (!target) {
    throw new Error("対象の発注候補が見つかりません。");
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
