"use server";

import { revalidatePath } from "next/cache";
import { auditActions } from "@/lib/audit/audit-log";
import { buildProductImportPreview, type ProductImportPreview, type ProductImportSourceType } from "@/lib/imports/product-master-import";
import { requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";

export type ProductImportActionState = {
  status?: "success" | "error";
  message?: string;
  preview?: ProductImportPreview;
  sourceText?: string;
  sourceType?: ProductImportSourceType;
  fileName?: string;
};

function toActionError(error: unknown): ProductImportActionState {
  if (error instanceof Error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  return {
    status: "error",
    message: "商品マスタの取り込み処理に失敗しました。",
  };
}

function normalizeSourceType(value: FormDataEntryValue | null): ProductImportSourceType {
  return value === "TSV" ? "TSV" : "CSV";
}

function readSourceText(formData: FormData) {
  return String(formData.get("sourceText") ?? "").trim();
}

async function getPreviewData(organizationId: string, sourceText: string, sourceType: ProductImportSourceType) {
  const [existingProducts, suppliers] = await Promise.all([
    prisma.product.findMany({
      where: {
        organizationId,
        isActive: true,
        janCode: {
          not: null,
        },
      },
      select: {
        janCode: true,
      },
    }),
    prisma.supplier.findMany({
      where: {
        organizationId,
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return buildProductImportPreview({
    text: sourceText,
    sourceType,
    existingJanCodes: existingProducts.map((product) => product.janCode).filter((janCode): janCode is string => Boolean(janCode)),
    suppliers,
  });
}

export async function previewProductImportForContext(options: {
  organizationId: string;
  sourceText: string;
  sourceType: ProductImportSourceType;
}) {
  return getPreviewData(options.organizationId, options.sourceText, options.sourceType);
}

export async function importProductsForContext(options: {
  organizationId: string;
  userId: string;
  sourceText: string;
  sourceType: ProductImportSourceType;
  fileName?: string | null;
}) {
  const preview = await getPreviewData(options.organizationId, options.sourceText, options.sourceType);

  if (preview.summary.errorRows > 0) {
    throw new Error("エラーがある行は取り込めません。内容を修正してから再度プレビューしてください。");
  }

  const rowsToCreate = preview.rows.filter((row) => row.willCreate);

  return prisma.$transaction(async (tx) => {
    const created =
      rowsToCreate.length > 0
        ? await tx.product.createMany({
            data: rowsToCreate.map((row) => ({
              organizationId: options.organizationId,
              name: row.name,
              productCode: row.productCode,
              janCode: row.janCode,
              internalCode: row.internalCode,
              category: row.category,
              manufacturer: row.manufacturer,
              specification: row.specification,
              orderUnit: row.orderUnit,
              primarySupplierId: row.primarySupplierId,
              supplierProductCode: row.supplierProductCode,
              standardPrice: row.standardPrice,
              defaultMinStock: row.defaultMinStock,
              notes: row.notes,
            })),
            skipDuplicates: true,
          })
        : { count: 0 };
    const skippedRows = preview.summary.totalRows - created.count;

    await tx.productImportHistory.create({
      data: {
        organizationId: options.organizationId,
        userId: options.userId,
        sourceType: options.sourceType,
        fileName: options.fileName?.trim() || null,
        totalRows: preview.summary.totalRows,
        validRows: preview.summary.validRows,
        createdRows: created.count,
        skippedRows,
        errorRows: preview.summary.errorRows,
        warningRows: preview.summary.warningRows,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: options.organizationId,
        actorUserId: options.userId,
        action: auditActions.productImport,
        targetType: "Product",
        detailsJson: {
          sourceType: options.sourceType,
          totalRows: preview.summary.totalRows,
          createdRows: created.count,
          skippedRows,
          warningRows: preview.summary.warningRows,
          errorRows: preview.summary.errorRows,
        },
      },
    });

    return {
      preview,
      createdRows: created.count,
      skippedRows,
    };
  });
}

export async function previewProductImportAction(
  _previousState: ProductImportActionState,
  formData: FormData,
): Promise<ProductImportActionState> {
  const sourceText = readSourceText(formData);
  const sourceType = normalizeSourceType(formData.get("sourceType"));
  const fileName = String(formData.get("fileName") ?? "").trim();

  try {
    const context = await requireActiveClinic();
    const preview = await previewProductImportForContext({
      organizationId: context.organizationId,
      sourceText,
      sourceType,
    });

    return {
      status: preview.summary.errorRows > 0 ? "error" : "success",
      message:
        preview.summary.errorRows > 0
          ? "エラー行があります。内容を修正してから取り込んでください。"
          : "プレビューを作成しました。内容を確認してから確定してください。",
      preview,
      sourceText,
      sourceType,
      fileName,
    };
  } catch (error) {
    return {
      ...toActionError(error),
      sourceText,
      sourceType,
      fileName,
    };
  }
}

export async function confirmProductImportAction(
  _previousState: ProductImportActionState,
  formData: FormData,
): Promise<ProductImportActionState> {
  const sourceText = readSourceText(formData);
  const sourceType = normalizeSourceType(formData.get("sourceType"));
  const fileName = String(formData.get("fileName") ?? "").trim();

  try {
    const context = await requireActiveClinic();
    const result = await importProductsForContext({
      organizationId: context.organizationId,
      userId: context.userId,
      sourceText,
      sourceType,
      fileName,
    });

    revalidatePath("/home");
    revalidatePath("/products");
    revalidatePath("/products/import");

    return {
      status: "success",
      message: `${result.createdRows}件の商品を取り込みました。${result.skippedRows}件は作成対象外でした。`,
      preview: result.preview,
      sourceText,
      sourceType,
      fileName,
    };
  } catch (error) {
    return {
      ...toActionError(error),
      sourceText,
      sourceType,
      fileName,
    };
  }
}
