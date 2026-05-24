"use server";

import { revalidatePath } from "next/cache";
import { auditActions, writeAuditLog } from "@/lib/audit/audit-log";
import { requireAdminUser } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import {
  buildSupplierImportPreview,
  type SupplierImportPreview,
  type SupplierImportSourceType,
} from "@/lib/imports/supplier-master-import";

export type SupplierImportActionState = {
  status?: "success" | "error";
  message?: string;
  preview?: SupplierImportPreview;
  sourceText?: string;
  sourceType?: SupplierImportSourceType;
  fileName?: string;
};

function toActionError(error: unknown): SupplierImportActionState {
  if (error instanceof Error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  return {
    status: "error",
    message: "発注先マスタの取り込み処理に失敗しました。",
  };
}

function normalizeSourceType(value: FormDataEntryValue | null): SupplierImportSourceType {
  return value === "TSV" ? "TSV" : "CSV";
}

function readSourceText(formData: FormData) {
  return String(formData.get("sourceText") ?? "").trim();
}

async function getPreviewData(organizationId: string, sourceText: string, sourceType: SupplierImportSourceType) {
  const suppliers = await prisma.supplier.findMany({
    where: {
      organizationId,
    },
    select: {
      name: true,
    },
  });

  return buildSupplierImportPreview({
    text: sourceText,
    sourceType,
    existingSupplierNames: suppliers.map((supplier) => supplier.name),
  });
}

export async function previewSupplierImportForContext(options: {
  organizationId: string;
  sourceText: string;
  sourceType: SupplierImportSourceType;
}) {
  return getPreviewData(options.organizationId, options.sourceText, options.sourceType);
}

export async function importSuppliersForContext(options: {
  organizationId: string;
  userId: string;
  sourceText: string;
  sourceType: SupplierImportSourceType;
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
        ? await tx.supplier.createMany({
            data: rowsToCreate.map((row) => ({
              organizationId: options.organizationId,
              name: row.name,
              address: row.address,
              phone: row.phone,
              fax: row.fax,
              email: row.email,
              contactPersonName: row.contactPersonName,
              contactPersonEmail: row.contactPersonEmail,
              notes: row.notes,
            })),
          })
        : { count: 0 };
    const skippedRows = preview.summary.totalRows - created.count;

    await tx.auditLog.create({
      data: {
        organizationId: options.organizationId,
        actorUserId: options.userId,
        action: auditActions.supplierImport,
        targetType: "Supplier",
        detailsJson: {
          sourceType: options.sourceType,
          fileName: options.fileName?.trim() || null,
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

export async function previewSupplierImportAction(
  _previousState: SupplierImportActionState,
  formData: FormData,
): Promise<SupplierImportActionState> {
  const sourceText = readSourceText(formData);
  const sourceType = normalizeSourceType(formData.get("sourceType"));
  const fileName = String(formData.get("fileName") ?? "").trim();

  try {
    const context = await requireAdminUser({
      unauthorizedRedirectTo: "/suppliers",
    });
    const preview = await previewSupplierImportForContext({
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

export async function confirmSupplierImportAction(
  _previousState: SupplierImportActionState,
  formData: FormData,
): Promise<SupplierImportActionState> {
  const sourceText = readSourceText(formData);
  const sourceType = normalizeSourceType(formData.get("sourceType"));
  const fileName = String(formData.get("fileName") ?? "").trim();

  try {
    const context = await requireAdminUser({
      unauthorizedRedirectTo: "/suppliers",
    });
    const result = await importSuppliersForContext({
      organizationId: context.organizationId,
      userId: context.userId,
      sourceText,
      sourceType,
      fileName,
    });

    revalidatePath("/home");
    revalidatePath("/suppliers");
    revalidatePath("/suppliers/import");
    revalidatePath("/products/import");

    return {
      status: "success",
      message: `${result.createdRows}件の発注先を取り込みました。${result.skippedRows}件は作成対象外でした。`,
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
