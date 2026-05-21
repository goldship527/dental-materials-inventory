"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auditActions, writeAuditLog } from "@/lib/audit/audit-log";
import { type ActiveClinicContext, requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";

const idSchema = z.string().min(1);
const quantitySchema = z.coerce.number().int().min(0).max(999999);
const memoSchema = z.string().trim().max(200).optional();

const updateItemSchema = z.object({
  sessionId: idSchema,
  itemId: idSchema,
  countedQuantity: quantitySchema,
  memo: memoSchema,
});

const skipItemSchema = z.object({
  sessionId: idSchema,
  itemId: idSchema,
  memo: memoSchema,
});

export type StocktakeSessionActionState = {
  status: "success" | "error";
  message: string;
};

export type StocktakeSessionItemActionResult = StocktakeSessionActionState & {
  item?: {
    id: string;
    status: string;
    countedQuantity: number | null;
    diff: number | null;
    memo: string | null;
    countedAt: Date | null;
  };
};

function revalidateStocktakeSessionPages(sessionId?: string) {
  revalidatePath("/home");
  revalidatePath("/inventory");
  revalidatePath("/shortage");
  revalidatePath("/movements");
  revalidatePath("/stocktake");
  revalidatePath("/stocktake/sessions");
  revalidatePath("/stocktake/sessions/new");

  if (sessionId) {
    revalidatePath(`/stocktake/sessions/${sessionId}`);
    revalidatePath(`/stocktake/sessions/${sessionId}/history`);
  }
}

function toActionError(error: unknown): StocktakeSessionActionState {
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
    message: "棚卸セッションを更新できませんでした。",
  };
}

export async function startStocktakeSessionAction(formData: FormData) {
  const context = await requireActiveClinic();
  const memo = memoSchema.parse(formData.get("memo")?.toString() ?? undefined);

  const sessionId = await prisma.$transaction(async (tx) => {
    const existingSession = await tx.stocktakeSession.findFirst({
      where: {
        clinicId: context.clinicId,
        status: "IN_PROGRESS",
      },
      select: {
        id: true,
      },
      orderBy: {
        startedAt: "desc",
      },
    });

    if (existingSession) {
      return existingSession.id;
    }

    const stockItems = await tx.stockItem.findMany({
      where: {
        clinicId: context.clinicId,
        isUsed: true,
        product: {
          isActive: true,
        },
      },
      select: {
        productId: true,
        quantity: true,
      },
      orderBy: [
        {
          product: {
            category: "asc",
          },
        },
        {
          product: {
            name: "asc",
          },
        },
      ],
    });

    const createdSession = await tx.stocktakeSession.create({
      data: {
        clinicId: context.clinicId,
        startedByUserId: context.userId,
        memo,
      },
      select: {
        id: true,
      },
    });

    if (stockItems.length > 0) {
      await tx.stocktakeSessionItem.createMany({
        data: stockItems.map((item) => ({
          sessionId: createdSession.id,
          productId: item.productId,
          expectedQuantity: item.quantity,
          status: "PENDING",
        })),
      });
    }

    return createdSession.id;
  });

  revalidateStocktakeSessionPages(sessionId);
  redirect(`/stocktake/sessions/${sessionId}`);
}

export async function updateStocktakeSessionItemAction(
  input: z.input<typeof updateItemSchema>,
): Promise<StocktakeSessionItemActionResult> {
  try {
    const context = await requireActiveClinic();
    const parsedInput = updateItemSchema.parse(input);

    const updatedItem = await prisma.$transaction(async (tx) => {
      const item = await tx.stocktakeSessionItem.findFirst({
        where: {
          id: parsedInput.itemId,
          sessionId: parsedInput.sessionId,
          session: {
            clinicId: context.clinicId,
            status: "IN_PROGRESS",
          },
        },
        select: {
          id: true,
          expectedQuantity: true,
          product: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!item) {
        throw new Error("入力中の棚卸明細が見つかりません。");
      }

      return tx.stocktakeSessionItem.update({
        where: {
          id: item.id,
        },
        data: {
          countedQuantity: parsedInput.countedQuantity,
          diff: parsedInput.countedQuantity - item.expectedQuantity,
          status: "COUNTED",
          memo: parsedInput.memo || null,
          countedAt: new Date(),
          countedByUserId: context.userId,
        },
        select: {
          id: true,
          status: true,
          countedQuantity: true,
          diff: true,
          memo: true,
          countedAt: true,
          product: {
            select: {
              name: true,
            },
          },
        },
      });
    });

    revalidateStocktakeSessionPages(parsedInput.sessionId);

    return {
      status: "success",
      message: `${updatedItem.product.name} を保存しました。`,
      item: {
        id: updatedItem.id,
        status: updatedItem.status,
        countedQuantity: updatedItem.countedQuantity,
        diff: updatedItem.diff,
        memo: updatedItem.memo,
        countedAt: updatedItem.countedAt,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function skipStocktakeSessionItemAction(
  input: z.input<typeof skipItemSchema>,
): Promise<StocktakeSessionItemActionResult> {
  try {
    const context = await requireActiveClinic();
    const parsedInput = skipItemSchema.parse(input);

    const updatedItem = await prisma.$transaction(async (tx) => {
      const item = await tx.stocktakeSessionItem.findFirst({
        where: {
          id: parsedInput.itemId,
          sessionId: parsedInput.sessionId,
          session: {
            clinicId: context.clinicId,
            status: "IN_PROGRESS",
          },
        },
        select: {
          id: true,
        },
      });

      if (!item) {
        throw new Error("入力中の棚卸明細が見つかりません。");
      }

      return tx.stocktakeSessionItem.update({
        where: {
          id: item.id,
        },
        data: {
          countedQuantity: null,
          diff: null,
          status: "SKIPPED",
          memo: parsedInput.memo || null,
          countedAt: new Date(),
          countedByUserId: context.userId,
        },
        select: {
          id: true,
          status: true,
          countedQuantity: true,
          diff: true,
          memo: true,
          countedAt: true,
          product: {
            select: {
              name: true,
            },
          },
        },
      });
    });

    revalidateStocktakeSessionPages(parsedInput.sessionId);

    return {
      status: "success",
      message: `${updatedItem.product.name} をスキップしました。`,
      item: {
        id: updatedItem.id,
        status: updatedItem.status,
        countedQuantity: updatedItem.countedQuantity,
        diff: updatedItem.diff,
        memo: updatedItem.memo,
        countedAt: updatedItem.countedAt,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function discardStocktakeSessionAction(formData: FormData) {
  const context = await requireActiveClinic();
  const sessionId = idSchema.parse(formData.get("sessionId"));

  await prisma.stocktakeSession.updateMany({
    where: {
      id: sessionId,
      clinicId: context.clinicId,
      status: "IN_PROGRESS",
    },
    data: {
      status: "DISCARDED",
      discardedAt: new Date(),
    },
  });

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: auditActions.stocktakeSessionDiscard,
    targetType: "StocktakeSession",
    targetId: sessionId,
  });

  revalidateStocktakeSessionPages(sessionId);
  redirect("/stocktake/sessions");
}

export async function commitStocktakeSessionAction(formData: FormData) {
  const context = await requireActiveClinic();
  const sessionId = idSchema.parse(formData.get("sessionId"));

  await commitStocktakeSessionForContext({
    context,
    sessionId,
  });

  redirect(`/stocktake/sessions/${sessionId}`);
}

export async function commitStocktakeSessionForContext(options: {
  context: ActiveClinicContext;
  sessionId: string;
  revalidate?: boolean;
}) {
  const { context, sessionId } = options;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stocktake-session:${sessionId}`}))`;

    const session = await tx.stocktakeSession.findFirst({
      where: {
        id: sessionId,
        clinicId: context.clinicId,
        status: "IN_PROGRESS",
      },
      include: {
        items: {
          where: {
            status: "COUNTED",
            countedQuantity: {
              not: null,
            },
          },
          select: {
            productId: true,
            expectedQuantity: true,
            countedQuantity: true,
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new Error("入力中の棚卸セッションが見つかりません。");
    }

    for (const item of session.items) {
      if (item.countedQuantity === null) {
        continue;
      }

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock-item:${context.clinicId}:${item.productId}`}))`;

      const updateResult = await tx.stockItem.updateMany({
        where: {
          clinicId: context.clinicId,
          productId: item.productId,
          isUsed: true,
          quantity: item.expectedQuantity,
        },
        data: {
          quantity: item.countedQuantity,
        },
      });

      if (updateResult.count === 0) {
        throw new Error(
          `${item.product.name} は棚卸開始後に在庫数が変更されています。最新の在庫で棚卸セッションを作り直してください。`,
        );
      }
    }

    const changedItems = session.items.filter(
      (item): item is typeof item & { countedQuantity: number } =>
        item.countedQuantity !== null && item.countedQuantity !== item.expectedQuantity,
    );

    if (changedItems.length > 0) {
      await tx.stockMovement.createMany({
        data: changedItems.map((item) => ({
          clinicId: context.clinicId,
          productId: item.productId,
          movementType: "ADJUST",
          quantity: item.countedQuantity - item.expectedQuantity,
          beforeQuantity: item.expectedQuantity,
          afterQuantity: item.countedQuantity,
          reason: "棚卸セッション確定",
          sourceType: "STOCKTAKE_SESSION",
          sourceId: sessionId,
          userId: context.userId,
        })),
      });
    }

    await tx.stocktakeSession.update({
      where: {
        id: session.id,
      },
      data: {
        status: "COMMITTED",
        committedAt: new Date(),
        committedByUserId: context.userId,
      },
    });
  });

  if (options.revalidate ?? true) {
    revalidateStocktakeSessionPages(sessionId);
  }

  await writeAuditLog({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    action: auditActions.stocktakeSessionCommit,
    targetType: "StocktakeSession",
    targetId: sessionId,
  });
}
