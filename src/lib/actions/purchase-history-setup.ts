"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditActions } from "@/lib/audit/audit-log";
import { requireAdminUser, type AdminUserContext } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import {
  parsePurchaseHistorySetupItemsJson,
  type PurchaseHistorySetupInput,
} from "@/lib/purchase-history/setup-items";
import { isPurchaseHistoryImportSource, productImportSources } from "@/lib/products/import-source";

export type { PurchaseHistorySetupInput };

export type PurchaseHistorySetupActionState = {
  status?: "success" | "error";
  message?: string;
  updatedRows?: number;
};

function needsPurchaseHistorySetup(product: {
  category: string | null;
  defaultMinStock: number;
}) {
  return !product.category || product.category === "未分類" || product.defaultMinStock === 0;
}

function purchaseHistorySetupProductWhere(productId: string, organizationId: string) {
  return {
    id: productId,
    organizationId,
    isActive: true,
    importSource: productImportSources.purchaseHistory,
    AND: [
      {
        OR: [
          {
            category: null,
          },
          {
            category: "",
          },
          {
            category: "未分類",
          },
          {
            defaultMinStock: 0,
          },
        ],
      },
    ],
  };
}

function toActionError(error: unknown): PurchaseHistorySetupActionState {
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
    message: "購入履歴登録商品の一括整備に失敗しました。",
  };
}

function readItems(formData: FormData) {
  return parsePurchaseHistorySetupItemsJson(String(formData.get("items") ?? ""));
}

export async function updatePurchaseHistorySetupForContext(
  context: AdminUserContext,
  items: PurchaseHistorySetupInput[],
) {
  const uniqueItems = [...new Map(items.map((item) => [item.productId, item])).values()];

  if (uniqueItems.length === 0) {
    return {
      updatedRows: 0,
    };
  }

  await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: {
        organizationId: context.organizationId,
        isActive: true,
        id: {
          in: uniqueItems.map((item) => item.productId),
        },
      },
      select: {
        id: true,
        importSource: true,
        category: true,
        defaultMinStock: true,
      },
    });
    const eligibleProductIds = new Set(
      products
        .filter((product) => isPurchaseHistoryImportSource(product.importSource) && needsPurchaseHistorySetup(product))
        .map((product) => product.id),
    );

    if (eligibleProductIds.size !== uniqueItems.length) {
      throw new Error("対象外の商品が含まれています。購入履歴から登録した未整備の商品だけを選んでください。");
    }

    for (const item of uniqueItems) {
      const result = await tx.product.updateMany({
        where: purchaseHistorySetupProductWhere(item.productId, context.organizationId),
        data: {
          category: item.category,
          defaultMinStock: item.defaultMinStock,
        },
      });

      if (result.count !== 1) {
        throw new Error("対象外の商品が含まれています。購入履歴から登録した未整備の商品だけを選んでください。");
      }
    }

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: auditActions.purchaseHistorySetup,
        targetType: "Product",
        detailsJson: {
          updatedRows: uniqueItems.length,
          productIds: uniqueItems.map((item) => item.productId),
        },
      },
    });
  });

  return {
    updatedRows: uniqueItems.length,
  };
}

export async function updatePurchaseHistorySetupAction(
  _previousState: PurchaseHistorySetupActionState,
  formData: FormData,
): Promise<PurchaseHistorySetupActionState> {
  try {
    const context = await requireAdminUser({
      unauthorizedRedirectTo: "/products",
    });
    const result = await updatePurchaseHistorySetupForContext(context, readItems(formData));

    revalidatePath("/products");
    revalidatePath("/products/import/purchase-history/setup");

    return {
      status: "success",
      message:
        result.updatedRows > 0
          ? `${result.updatedRows}件の商品設定を更新しました。`
          : "更新対象の商品がありませんでした。",
      updatedRows: result.updatedRows,
    };
  } catch (error) {
    return toActionError(error);
  }
}
