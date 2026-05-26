"use server";

import { revalidatePath } from "next/cache";
import { auditActions } from "@/lib/audit/audit-log";
import { requireAdminUser } from "@/lib/auth/admin";
import { requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";
import {
  buildPurchaseHistoryImportPreview,
  type PurchaseHistoryExistingProduct,
  type PurchaseHistoryImportPreview,
  type PurchaseHistoryImportSourceType,
} from "@/lib/imports/purchase-history-import";
import {
  parsePurchaseHistoryReviewDecisionsJson,
  type PurchaseHistoryReviewDecision,
} from "@/lib/purchase-history/review-decisions";
import { buildProductNamesByIdForPreview } from "@/lib/purchase-history/product-name-map";
import { productImportSources } from "@/lib/products/import-source";

export type { PurchaseHistoryReviewDecision };

export type PurchaseHistoryImportActionState = {
  status?: "success" | "error";
  message?: string;
  preview?: PurchaseHistoryImportPreview;
  productNamesById?: Record<string, string>;
  sourceText?: string;
  sourceType?: PurchaseHistoryImportSourceType;
  fileName?: string;
};

function toActionError(error: unknown): PurchaseHistoryImportActionState {
  if (error instanceof Error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  return {
    status: "error",
    message: "購入履歴のプレビュー作成に失敗しました。",
  };
}

function normalizeSourceType(value: FormDataEntryValue | null): PurchaseHistoryImportSourceType {
  return value === "TSV" ? "TSV" : "CSV";
}

function readSourceText(formData: FormData) {
  return String(formData.get("sourceText") ?? "").trim();
}

function readReviewDecisions(formData: FormData): Record<number, PurchaseHistoryReviewDecision> {
  return parsePurchaseHistoryReviewDecisionsJson(String(formData.get("reviewDecisions") ?? ""));
}

function normalizeImportKey(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[\s_\-()（）/／・.．]/g, "");
}

function buildDealerNames(rows: PurchaseHistoryImportPreview["rows"]) {
  return Array.from(
    new Set(
      rows
        .map((row) => row.dealerName?.trim())
        .filter((dealerName): dealerName is string => Boolean(dealerName)),
    ),
  ).sort((a, b) => a.localeCompare(b, "ja"));
}

function buildCreateRowKey(row: PurchaseHistoryImportPreview["rows"][number]) {
  const janCode = row.janCode?.trim();

  if (janCode) {
    return `jan:${janCode}`;
  }

  const supplierProductCode = normalizeImportKey(row.supplierProductCode);

  if (supplierProductCode) {
    return `supplier-code:${supplierProductCode}`;
  }

  const dealerProductCode = normalizeImportKey(row.dealerProductCode);

  if (dealerProductCode) {
    return `dealer-code:${dealerProductCode}`;
  }

  return `name:${normalizeImportKey(row.manufacturer)}:${normalizeImportKey(row.productName)}`;
}

function assertReviewDecisionsComplete(
  preview: PurchaseHistoryImportPreview,
  reviewDecisions: Record<number, PurchaseHistoryReviewDecision>,
) {
  const missingRows = preview.rows
    .filter((row) => row.status === "NEEDS_REVIEW" && !reviewDecisions[row.rowNumber])
    .map((row) => row.rowNumber);

  if (missingRows.length > 0) {
    throw new Error("確認必要行の扱いが未選択です。すべての確認必要行で今回の扱いを選択してください。");
  }
}

async function getExistingProducts(organizationId: string): Promise<PurchaseHistoryExistingProduct[]> {
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      janCode: true,
      manufacturer: true,
      productCode: true,
      supplierProductCode: true,
      barcodes: {
        select: {
          barcode: true,
        },
      },
      productSuppliers: {
        where: {
          isActive: true,
        },
        select: {
          supplierProductCode: true,
        },
      },
    },
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    janCode: product.janCode,
    manufacturer: product.manufacturer,
    productCode: product.productCode,
    barcodes: product.barcodes.map((barcode) => barcode.barcode),
    supplierProductCodes: [
      product.supplierProductCode,
      ...product.productSuppliers.map((supplier) => supplier.supplierProductCode),
    ].filter((code): code is string => Boolean(code)),
  }));
}

export async function previewPurchaseHistoryImportForContext(options: {
  organizationId: string;
  sourceText: string;
  sourceType: PurchaseHistoryImportSourceType;
}) {
  const existingProducts = await getExistingProducts(options.organizationId);

  return buildPurchaseHistoryImportPreview({
    text: options.sourceText,
    sourceType: options.sourceType,
    existingProducts,
  });
}

export async function importPurchaseHistoryProductsForContext(options: {
  organizationId: string;
  clinicId?: string | null;
  userId: string;
  sourceText: string;
  sourceType: PurchaseHistoryImportSourceType;
  fileName?: string | null;
  reviewDecisions?: Record<number, PurchaseHistoryReviewDecision>;
}) {
  const [existingProducts, suppliers] = await Promise.all([
    getExistingProducts(options.organizationId),
    prisma.supplier.findMany({
      where: {
        organizationId: options.organizationId,
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);
  const preview = buildPurchaseHistoryImportPreview({
    text: options.sourceText,
    sourceType: options.sourceType,
    existingProducts,
  });

  if (preview.summary.errorRows > 0) {
    throw new Error("エラー行があるため登録できません。内容を修正してから再度プレビューしてください。");
  }

  const suppliersByName = new Map(suppliers.map((supplier) => [normalizeImportKey(supplier.name), supplier]));
  const dealerNames = buildDealerNames(preview.rows);
  const dealerNamesJson = dealerNames.length > 0 ? JSON.stringify(dealerNames) : null;
  const reviewDecisions = options.reviewDecisions ?? {};
  assertReviewDecisionsComplete(preview, reviewDecisions);
  const reviewCreateRows = preview.rows.filter(
    (row) => row.status === "NEEDS_REVIEW" && reviewDecisions[row.rowNumber] === "CREATE",
  ).length;
  const reviewExistingRows = preview.rows.filter(
    (row) => row.status === "NEEDS_REVIEW" && reviewDecisions[row.rowNumber] === "EXISTING",
  ).length;
  const reviewExcludedRows = preview.rows.filter(
    (row) => row.status === "NEEDS_REVIEW" && reviewDecisions[row.rowNumber] === "EXCLUDE",
  ).length;
  const createRows = preview.rows.filter(
    (row) => row.status === "CREATE" || (row.status === "NEEDS_REVIEW" && reviewDecisions[row.rowNumber] === "CREATE"),
  );
  const seenKeys = new Set<string>();
  const rowsToCreate = createRows.filter((row) => {
    const key = buildCreateRowKey(row);

    if (seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);
    return true;
  });

  return prisma.$transaction(async (tx) => {
    const created =
      rowsToCreate.length > 0
        ? await tx.product.createMany({
            data: rowsToCreate.map((row) => {
              const supplier = row.dealerName ? suppliersByName.get(normalizeImportKey(row.dealerName)) : null;

              return {
                organizationId: options.organizationId,
                name: row.productName,
                productCode: null,
                janCode: row.janCode,
                category: "未分類",
                manufacturer: row.manufacturer,
                specification: row.specification,
                primarySupplierId: supplier?.id ?? null,
                supplierProductCode: row.supplierProductCode ?? row.dealerProductCode,
                standardPrice: row.unitPrice,
                defaultMinStock: 0,
                importSource: productImportSources.purchaseHistory,
                notes: row.dealerName
                  ? `購入履歴から登録: ${row.dealerName}`
                  : "購入履歴から登録",
              };
            }),
            skipDuplicates: true,
          })
        : { count: 0 };
    const skippedRows = preview.summary.totalRows - created.count;

    await tx.productImportHistory.create({
      data: {
        organizationId: options.organizationId,
        clinicId: options.clinicId ?? null,
        userId: options.userId,
        sourceType: `PURCHASE_HISTORY_${options.sourceType}`,
        fileName: options.fileName?.trim() || null,
        dealerNames: dealerNamesJson,
        totalRows: preview.summary.totalRows,
        validRows: preview.summary.totalRows - preview.summary.errorRows,
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
        action: auditActions.purchaseHistoryImport,
        targetType: "Product",
        detailsJson: {
          sourceType: options.sourceType,
          fileName: options.fileName?.trim() || null,
          clinicId: options.clinicId ?? null,
          dealerNames,
          totalRows: preview.summary.totalRows,
          createRows: preview.summary.createRows,
          existingRows: preview.summary.existingRows,
          needsReviewRows: preview.summary.needsReviewRows,
          reviewCreateRows,
          reviewExistingRows,
          reviewExcludedRows,
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

export async function previewPurchaseHistoryImportAction(
  _previousState: PurchaseHistoryImportActionState,
  formData: FormData,
): Promise<PurchaseHistoryImportActionState> {
  const sourceText = readSourceText(formData);
  const sourceType = normalizeSourceType(formData.get("sourceType"));
  const fileName = String(formData.get("fileName") ?? "").trim();

  try {
    const context = await requireAdminUser({
      unauthorizedRedirectTo: "/products",
    });
    const existingProducts = await getExistingProducts(context.organizationId);
    const preview = buildPurchaseHistoryImportPreview({
      text: sourceText,
      sourceType,
      existingProducts,
    });
    const productNamesById = buildProductNamesByIdForPreview(existingProducts, preview);

    return {
      status: preview.summary.errorRows > 0 ? "error" : "success",
      message:
        preview.summary.errorRows > 0
          ? "エラー行があります。内容を修正してから再度プレビューしてください。"
          : "プレビューを作成しました。今回は確認表示のみで、商品マスタや在庫数は変更していません。",
      preview,
      productNamesById,
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

export async function confirmPurchaseHistoryImportAction(
  _previousState: PurchaseHistoryImportActionState,
  formData: FormData,
): Promise<PurchaseHistoryImportActionState> {
  const sourceText = readSourceText(formData);
  const sourceType = normalizeSourceType(formData.get("sourceType"));
  const fileName = String(formData.get("fileName") ?? "").trim();

  try {
    const reviewDecisions = readReviewDecisions(formData);
    const context = await requireAdminUser({
      unauthorizedRedirectTo: "/products",
    });
    const activeClinic = await requireActiveClinic();
    const result = await importPurchaseHistoryProductsForContext({
      organizationId: context.organizationId,
      clinicId: activeClinic.clinicId,
      userId: context.userId,
      sourceText,
      sourceType,
      fileName,
      reviewDecisions,
    });
    const existingProducts = await getExistingProducts(context.organizationId);
    const productNamesById = buildProductNamesByIdForPreview(existingProducts, result.preview);

    revalidatePath("/home");
    revalidatePath("/products");
    revalidatePath("/products/import");
    revalidatePath("/products/import/purchase-history");

    return {
      status: "success",
      message: `${result.createdRows}件の商品を商品マスタに追加しました。既存一致、確認必要、重複行は登録していません。`,
      preview: result.preview,
      productNamesById,
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
