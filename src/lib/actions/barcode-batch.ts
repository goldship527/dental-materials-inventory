"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { analyzeBarcodeInput } from "@/lib/barcode/gs1";
import { normalizeBarcodeText } from "@/lib/barcode/normalize";
import { isAllowedBarcodeStockReason } from "@/lib/barcode/stock-reasons";
import { searchProductsByBarcode } from "@/lib/db/barcodes";
import { requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";
import { findActiveStaffOperatorByIdForClinic, findActiveStaffOperatorForClinic } from "@/lib/db/staff-operators";
import { applyOrderReceiptLine } from "@/lib/actions/orders";
import { applyStockOutLine } from "@/lib/actions/barcode-stock";

const barcodeSchema = z
  .string()
  .transform((value) => normalizeBarcodeText(value))
  .pipe(z.string().min(1, "バーコードを読み取ってください。").max(300, "バーコードが長すぎます。"));
const modeSchema = z.enum(["IN", "OUT"]);
const staffOperatorIdSchema = z.string().trim().min(1, "作業スタッフを選択してください。");
const quantitySchema = z.coerce
  .number()
  .int("数量は整数で入力してください。")
  .min(1, "数量は1以上で入力してください。")
  .max(9999, "数量は9999以下で入力してください。");
const reasonSchema = z.string().trim().min(1, "理由を選択してください。").max(40, "理由が長すぎます。");
const reasonNoteSchema = z.string().trim().max(160, "補足メモは160文字以内で入力してください。");
const nullableTextInput = (value: unknown) => (value == null ? "" : value);
const receivedMemoSchema = z.preprocess(
  nullableTextInput,
  z.string().trim().max(200, "納品メモは200文字以内で入力してください。"),
);
const lotNumberSchema = z.preprocess(
  nullableTextInput,
  z.string().trim().max(120, "ロット番号は120文字以内で入力してください。"),
);
const expiryDateTextSchema = z
  .preprocess(nullableTextInput, z.string().trim().max(20, "有効期限は20文字以内で入力してください。"));

export type BatchScanResolution =
  | {
      kind: "staff";
      staffOperatorId: string;
      staffOperatorName: string;
      barcode: string;
    }
  | {
      kind: "product";
      status: "receivable" | "stock-out-ready" | "unknown" | "multiple-products" | "no-pending-order" | "multiple-pending-orders";
      barcode: string;
      productId: string | null;
      productName: string | null;
      productCode: string | null;
      currentQuantity: number | null;
      orderRequestId: string | null;
      requestedQuantity: number | null;
      supplierName: string | null;
      lotNumber: string | null;
      expiryDateText: string | null;
      expiryDateIso: string | null;
      message: string;
    };

export type BatchActionState = {
  status?: "success" | "error";
  message?: string;
  processedCount?: number;
  skippedCount?: number;
  skippedMessages?: string[];
};

type BatchContext = {
  userId: string;
  userName: string | null | undefined;
  organizationId: string;
  clinicId: string;
  clinicName: string;
};

type BatchOrderReceiveLine = {
  orderRequestId: string;
  barcode: string;
  receivedQuantity: number;
  receivedMemo: string | null;
  receivedLotNumber: string | null;
  receivedExpiryDateText: string | null;
};

type BatchStockOutLine = {
  productId: string;
  barcode: string;
  quantity: number;
};

function revalidateBatchPages() {
  revalidatePath("/barcode/batch");
  revalidatePath("/barcode/stock");
  revalidatePath("/home");
  revalidatePath("/inventory");
  revalidatePath("/quick");
  revalidatePath("/shortage");
  revalidatePath("/orders");
  revalidatePath("/movements");
  revalidatePath("/products");
}

function toBatchActionError(error: unknown): BatchActionState {
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
    message: "一括処理を確定できませんでした。",
  };
}

function parseJsonArray<T>(value: unknown, schema: z.ZodType<T>) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("確定対象のリストが空です。");
  }

  const parsed = JSON.parse(value) as unknown;
  return z.array(schema).min(1, "確定対象のリストが空です。").parse(parsed);
}

function buildReason(reason: string, note: string) {
  return note ? `${reason}: ${note}` : reason;
}

function formatExpiryDateIso(date: Date | null) {
  return date ? date.toISOString() : null;
}

function parseBatchReceivedExpiryDateText(value: string | null | undefined) {
  const text = value?.trim() ?? "";

  if (!text) {
    return null;
  }

  if (/^\d{6}$/.test(text)) {
    const year = 2000 + Number(text.slice(0, 2));
    const month = Number(text.slice(2, 4));
    const dayText = text.slice(4, 6);
    const day = Number(dayText);

    if (month < 1 || month > 12) {
      throw new Error("有効期限の日付を確認してください。");
    }

    const resolvedDay = day === 0 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : day;
    const parsedDate = new Date(Date.UTC(year, month - 1, resolvedDay));

    if (
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== month - 1 ||
      parsedDate.getUTCDate() !== resolvedDay
    ) {
      throw new Error("有効期限の日付を確認してください。");
    }

    return parsedDate;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error("有効期限は日付形式で入力してください。");
  }

  const [yearText, monthText, dayText] = text.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new Error("有効期限の日付を確認してください。");
  }

  return parsedDate;
}

async function resolveActiveStaffOperator(context: BatchContext, staffOperatorId: string) {
  const staffOperator = await findActiveStaffOperatorByIdForClinic({
    organizationId: context.organizationId,
    clinicId: context.clinicId,
    staffOperatorId: staffOperatorIdSchema.parse(staffOperatorId),
  });

  if (!staffOperator) {
    throw new Error("このクリニックで有効な作業スタッフを選択してください。");
  }

  return staffOperator;
}

async function findPendingOrdersForProduct(context: BatchContext, productId: string) {
  return prisma.orderRequest.findMany({
    where: {
      clinicId: context.clinicId,
      productId,
      status: "ORDERED",
      receivedAt: null,
      clinic: {
        organizationId: context.organizationId,
      },
      product: {
        organizationId: context.organizationId,
        isActive: true,
      },
    },
    select: {
      id: true,
      requestedQuantity: true,
      supplier: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      orderedAt: "asc",
    },
  });
}

export async function resolveBatchScanForContext(
  context: BatchContext,
  input: {
    mode: "IN" | "OUT";
    barcode: string;
  },
): Promise<BatchScanResolution> {
  const mode = modeSchema.parse(input.mode);
  const barcode = barcodeSchema.parse(input.barcode);
  const staffOperator = await findActiveStaffOperatorForClinic({
    organizationId: context.organizationId,
    clinicId: context.clinicId,
    barcode,
  });

  if (staffOperator) {
    return {
      kind: "staff",
      staffOperatorId: staffOperator.id,
      staffOperatorName: staffOperator.displayName,
      barcode,
    };
  }

  const analysis = analyzeBarcodeInput(barcode);
  const matches = await searchProductsByBarcode(context.clinicId, barcode);
  const lotNumber = analysis.lotNumber?.slice(0, 120) ?? null;
  const expiryDateText = analysis.expiryDateText?.slice(0, 20) ?? null;
  const expiryDateIso = formatExpiryDateIso(analysis.expiryDate);

  if (matches.length === 0) {
    return {
      kind: "product",
      status: "unknown",
      barcode,
      productId: null,
      productName: null,
      productCode: null,
      currentQuantity: null,
      orderRequestId: null,
      requestedQuantity: null,
      supplierName: null,
      lotNumber,
      expiryDateText,
      expiryDateIso,
      message: "未登録バーコードです。確定対象から外します。",
    };
  }

  if (matches.length > 1) {
    return {
      kind: "product",
      status: "multiple-products",
      barcode,
      productId: null,
      productName: null,
      productCode: null,
      currentQuantity: null,
      orderRequestId: null,
      requestedQuantity: null,
      supplierName: null,
      lotNumber,
      expiryDateText,
      expiryDateIso,
      message: "複数の商品に一致しました。MVPでは自動確定しません。",
    };
  }

  const match = matches[0]!;

  if (mode === "OUT") {
    return {
      kind: "product",
      status: "stock-out-ready",
      barcode,
      productId: match.productId,
      productName: match.productName,
      productCode: match.productCode,
      currentQuantity: match.quantity,
      orderRequestId: null,
      requestedQuantity: null,
      supplierName: match.supplierName,
      lotNumber,
      expiryDateText,
      expiryDateIso,
      message: "出庫リストに追加できます。",
    };
  }

  const pendingOrders = await findPendingOrdersForProduct(context, match.productId);

  if (pendingOrders.length === 0) {
    return {
      kind: "product",
      status: "no-pending-order",
      barcode,
      productId: match.productId,
      productName: match.productName,
      productCode: match.productCode,
      currentQuantity: match.quantity,
      orderRequestId: null,
      requestedQuantity: null,
      supplierName: match.supplierName,
      lotNumber,
      expiryDateText,
      expiryDateIso,
      message: "納品待ちの発注がありません。確定対象から外します。",
    };
  }

  if (pendingOrders.length > 1) {
    return {
      kind: "product",
      status: "multiple-pending-orders",
      barcode,
      productId: match.productId,
      productName: match.productName,
      productCode: match.productCode,
      currentQuantity: match.quantity,
      orderRequestId: null,
      requestedQuantity: null,
      supplierName: match.supplierName,
      lotNumber,
      expiryDateText,
      expiryDateIso,
      message: "納品待ちが複数あります。MVPでは自動確定しません。",
    };
  }

  const pendingOrder = pendingOrders[0]!;

  return {
    kind: "product",
    status: "receivable",
    barcode,
    productId: match.productId,
    productName: match.productName,
    productCode: match.productCode,
    currentQuantity: match.quantity,
    orderRequestId: pendingOrder.id,
    requestedQuantity: pendingOrder.requestedQuantity,
    supplierName: pendingOrder.supplier?.name ?? match.supplierName,
    lotNumber,
    expiryDateText,
    expiryDateIso,
    message: "納品待ち1件に一致しました。",
  };
}

export async function resolveBatchScanAction(input: {
  mode: "IN" | "OUT";
  barcode: string;
}): Promise<BatchScanResolution> {
  const context = await requireActiveClinic();
  return resolveBatchScanForContext(context, input);
}

const batchOrderReceiveLineSchema = z.object({
  orderRequestId: z.string().min(1),
  barcode: barcodeSchema,
  receivedQuantity: quantitySchema,
  receivedMemo: receivedMemoSchema.transform((value) => (value.length > 0 ? value : null)),
  receivedLotNumber: lotNumberSchema.transform((value) => (value.length > 0 ? value : null)),
  receivedExpiryDateText: expiryDateTextSchema.transform((value) => (value.length > 0 ? value : null)),
});

const batchStockOutLineSchema = z.object({
  productId: z.string().min(1),
  barcode: barcodeSchema,
  quantity: quantitySchema,
});

export async function batchOrderReceiveForContext(
  context: BatchContext,
  input: {
    staffOperatorId: string;
    lines: BatchOrderReceiveLine[];
    revalidate?: boolean;
  },
): Promise<BatchActionState> {
  const staffOperator = await resolveActiveStaffOperator(context, input.staffOperatorId);
  const lines = z.array(batchOrderReceiveLineSchema).min(1).parse(input.lines);
  const skippedMessages: string[] = [];
  let processedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      try {
        await applyOrderReceiptLine(tx, {
          context,
          orderRequestId: line.orderRequestId,
          receivedQuantity: line.receivedQuantity,
          receivedByStaffId: staffOperator.id,
          receivedMemo: line.receivedMemo,
          receivedLotNumber: line.receivedLotNumber,
          receivedExpiryDateText: line.receivedExpiryDateText,
          receivedExpiryDate: parseBatchReceivedExpiryDateText(line.receivedExpiryDateText),
          applyToStock: true,
        });
        processedCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "納品確定できませんでした。";

        if (
          message.includes("すでに納品確認済み") ||
          message.includes("納品待ちの候補だけ") ||
          message.includes("対象の発注候補が見つかりません")
        ) {
          skippedMessages.push(`${line.barcode}: ${message}`);
          continue;
        }

        throw error;
      }
    }
  });

  if (input.revalidate ?? true) {
    revalidateBatchPages();
  }

  return {
    status: "success",
    message: `一括納品を確定しました。確定 ${processedCount} 件 / 除外 ${skippedMessages.length} 件。`,
    processedCount,
    skippedCount: skippedMessages.length,
    skippedMessages,
  };
}

export async function batchStockOutForContext(
  context: BatchContext,
  input: {
    staffOperatorId: string;
    reason: string;
    reasonNote: string;
    lines: BatchStockOutLine[];
    skipShortageLines?: boolean;
    revalidate?: boolean;
  },
): Promise<BatchActionState> {
  const staffOperator = await resolveActiveStaffOperator(context, input.staffOperatorId);
  const reason = reasonSchema.parse(input.reason);
  const reasonNote = reasonNoteSchema.parse(input.reasonNote);
  const lines = z.array(batchStockOutLineSchema).min(1).parse(input.lines);

  if (!isAllowedBarcodeStockReason("OUT", reason)) {
    throw new Error("出庫理由を選択してください。");
  }

  const skippedMessages: string[] = [];
  let processedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      try {
        await applyStockOutLine(tx, {
          context,
          staffOperatorId: staffOperator.id,
          barcode: line.barcode,
          productId: line.productId,
          quantity: line.quantity,
          reasonText: buildReason(reason, reasonNote),
        });
        processedCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "出庫確定できませんでした。";

        if (input.skipShortageLines && message.includes("現在庫を超える数量は出庫できません")) {
          skippedMessages.push(`${line.barcode}: ${message}`);
          continue;
        }

        throw error;
      }
    }
  });

  if (input.revalidate ?? true) {
    revalidateBatchPages();
  }

  return {
    status: "success",
    message: `一括出庫を確定しました。確定 ${processedCount} 件 / 除外 ${skippedMessages.length} 件。`,
    processedCount,
    skippedCount: skippedMessages.length,
    skippedMessages,
  };
}

export async function batchOrderReceiveAction(
  _previousState: BatchActionState,
  formData: FormData,
): Promise<BatchActionState> {
  try {
    const context = await requireActiveClinic();
    const staffOperatorId = staffOperatorIdSchema.parse(formData.get("staffOperatorId"));
    const lines = parseJsonArray(formData.get("lines"), batchOrderReceiveLineSchema);

    return batchOrderReceiveForContext(context, {
      staffOperatorId,
      lines,
    });
  } catch (error) {
    return toBatchActionError(error);
  }
}

export async function batchStockOutAction(
  _previousState: BatchActionState,
  formData: FormData,
): Promise<BatchActionState> {
  try {
    const context = await requireActiveClinic();
    const staffOperatorId = staffOperatorIdSchema.parse(formData.get("staffOperatorId"));
    const reason = reasonSchema.parse(formData.get("reason"));
    const reasonNote = reasonNoteSchema.parse(formData.get("reasonNote") ?? "");
    const skipShortageLines = formData.get("skipShortageLines") === "on";
    const lines = parseJsonArray(formData.get("lines"), batchStockOutLineSchema);

    return batchStockOutForContext(context, {
      staffOperatorId,
      reason,
      reasonNote,
      lines,
      skipShortageLines,
    });
  } catch (error) {
    return toBatchActionError(error);
  }
}
