"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditActions, writeAuditLog } from "@/lib/audit/audit-log";
import { type ActiveClinicContext, requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";

const movementIdSchema = z.string().min(1);

export type StockMovementActionState = {
  status?: "success" | "error";
  message?: string;
};

function revalidateStockMovementPages() {
  revalidatePath("/home");
  revalidatePath("/inventory");
  revalidatePath("/shortage");
  revalidatePath("/movements");
}

function toActionError(error: unknown): StockMovementActionState {
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
    message: "入出庫履歴を取り消せませんでした。",
  };
}

export async function revertStockMovementForContext(options: {
  context: ActiveClinicContext;
  movementId: string;
  revalidate?: boolean;
}) {
  const { context, movementId } = options;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock-movement:${movementId}`}))`;

    const movement = await tx.stockMovement.findFirst({
      where: {
        id: movementId,
        clinicId: context.clinicId,
      },
      select: {
        id: true,
        productId: true,
        beforeQuantity: true,
        afterQuantity: true,
        sourceType: true,
        revertedAt: true,
        revertOfId: true,
        product: {
          select: {
            name: true,
            isActive: true,
          },
        },
      },
    });

    if (!movement || !movement.product.isActive) {
      throw new Error("取り消し対象の履歴が見つかりません。");
    }

    if (movement.sourceType === "STOCKTAKE_SESSION") {
      throw new Error("棚卸セッション由来の履歴は、この画面からは取り消せません。");
    }

    if (movement.revertedAt) {
      throw new Error("この履歴はすでに取り消し済みです。");
    }

    if (movement.revertOfId) {
      throw new Error("取り消し操作の履歴は、さらに取り消すことはできません。");
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock-item:${context.clinicId}:${movement.productId}`}))`;

    const updateResult = await tx.stockItem.updateMany({
      where: {
        clinicId: context.clinicId,
        productId: movement.productId,
        isUsed: true,
        quantity: movement.afterQuantity,
      },
      data: {
        quantity: movement.beforeQuantity,
      },
    });

    if (updateResult.count === 0) {
      throw new Error(
        "この履歴の後に在庫数が変更されています。現在庫を確認してから、必要であれば在庫一覧で調整してください。",
      );
    }

    const revertedAt = new Date();

    await tx.stockMovement.create({
      data: {
        clinicId: context.clinicId,
        productId: movement.productId,
        movementType: "ADJUST",
        quantity: movement.beforeQuantity - movement.afterQuantity,
        beforeQuantity: movement.afterQuantity,
        afterQuantity: movement.beforeQuantity,
        reason: "履歴取り消し",
        sourceType: "REVERT",
        sourceId: movement.id,
        revertOfId: movement.id,
        userId: context.userId,
      },
    });

    await tx.stockMovement.update({
      where: {
        id: movement.id,
      },
      data: {
        revertedAt,
        revertedById: context.userId,
      },
    });

    return {
      productName: movement.product.name,
      beforeQuantity: movement.afterQuantity,
      afterQuantity: movement.beforeQuantity,
    };
  });

  if (options.revalidate ?? true) {
    revalidateStockMovementPages();
  }

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: auditActions.stockMovementRevert,
    targetType: "StockMovement",
    targetId: movementId,
    details: {
      productName: result.productName,
    },
  });

  return result;
}

export async function revertStockMovementAction(
  _previousState: StockMovementActionState,
  formData: FormData,
): Promise<StockMovementActionState> {
  try {
    const context = await requireActiveClinic();
    const movementId = movementIdSchema.parse(formData.get("movementId"));
    const result = await revertStockMovementForContext({
      context,
      movementId,
    });

    return {
      status: "success",
      message: `${result.productName} の履歴を取り消しました。在庫数は ${result.beforeQuantity} -> ${result.afterQuantity} に戻りました。`,
    };
  } catch (error) {
    return toActionError(error);
  }
}
