"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createOrFindTestProductFromSampleForContext } from "@/lib/actions/imports";
import { analyzeBarcodeInput } from "@/lib/barcode/gs1";
import { searchProductsByBarcode } from "@/lib/db/barcodes";
import { type ActiveClinicContext, requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";
import {
  findMedicalDeviceSampleRecord,
  findMedicalDeviceSampleRecordsByJan,
  type MedicalDeviceSampleRecord,
} from "@/lib/imports/medical-device-samples";

const createBarcodeScanLogSchema = z.object({
  rawInput: z.string().trim().min(1, "読み取り値がありません。").max(300, "読み取り値は300文字以内で保存してください。"),
});
const resolveBarcodeScanLogSchema = z.object({
  logId: z.string().trim().min(1),
  resolvedNote: z
    .string()
    .trim()
    .max(500, "メモは500文字以内で入力してください。")
    .transform((value) => (value.length > 0 ? value : null)),
});
const promoteBarcodeScanLogSchema = z.object({
  logId: z.string().trim().min(1),
});

const unresolvedResolveMatchTypes = ["NO_MATCH", "PRODUCT_MULTI", "SAMPLE"] as const;

function revalidateBarcodeScanLogPages() {
  revalidatePath("/barcode");
  revalidatePath("/barcode/scans");
  revalidatePath("/barcode/scans/unresolved");
  revalidatePath("/barcode/scans/unmatched");
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

type CreateBarcodeScanLogForContextOptions = {
  context: ActiveClinicContext;
  rawInput: string;
  searchProducts?: typeof searchProductsByBarcode;
  findSampleRecordsByJan?: (janCode: string, limit?: number) => Promise<MedicalDeviceSampleRecord[]>;
};

export async function createBarcodeScanLogForContext(options: CreateBarcodeScanLogForContextOptions) {
  const input = createBarcodeScanLogSchema.parse({
    rawInput: options.rawInput,
  });
  const searchProducts = options.searchProducts ?? searchProductsByBarcode;
  const findSampleRecordsByJan = options.findSampleRecordsByJan ?? findMedicalDeviceSampleRecordsByJan;
  const analysis = analyzeBarcodeInput(input.rawInput);
  const productMatches = await searchProducts(options.context.clinicId, input.rawInput);
  const hasMultipleProducts = productMatches.length > 1;
  const firstProduct = hasMultipleProducts ? null : (productMatches[0] ?? null);
  const sampleMatches =
    productMatches.length === 0 && analysis.extractedJan13
      ? await findSampleRecordsByJan(analysis.extractedJan13, 1)
      : [];
  const firstSample = sampleMatches[0] ?? null;
  const matchType = hasMultipleProducts ? "PRODUCT_MULTI" : firstProduct ? "PRODUCT" : firstSample ? "SAMPLE" : "NO_MATCH";

  return prisma.barcodeScanLog.create({
    data: {
      clinicId: options.context.clinicId,
      userId: options.context.userId,
      productId: firstProduct?.productId ?? null,
      rawInput: input.rawInput,
      extractedBarcode: analysis.extractedBarcode,
      extractedJan13: analysis.extractedJan13,
      extractedGtin: analysis.extractedGtin,
      scannedAtText: null,
      scannedAt: null,
      lotNumber: analysis.lotNumber,
      serialNumber: analysis.serialNumber,
      expiryDateText: analysis.expiryDateText,
      expiryDate: analysis.expiryDate,
      matchType,
      sampleJanCode: firstSample?.janCode ?? null,
      sampleProductName: firstSample?.productName ?? null,
      sampleManufacturer: firstSample?.manufacturer ?? null,
      sampleSourceFile: firstSample?.sourceFile ?? null,
      sampleSourceSheet: firstSample?.sourceSheet ?? null,
      sampleSourceRow: firstSample?.sourceRow ?? null,
      sampleJmdnCode: firstSample?.jmdnCode ?? null,
      sampleGenericName: firstSample?.genericName ?? null,
    },
  });
}

export async function createBarcodeScanLogAction(formData: FormData) {
  const context = await requireActiveClinic();
  const input = createBarcodeScanLogSchema.parse({
    rawInput: formData.get("rawInput") ?? "",
  });

  await createBarcodeScanLogForContext({
    context,
    rawInput: input.rawInput,
  });

  revalidatePath("/barcode");
  revalidatePath("/barcode/scans");

  redirect(`/barcode?barcode=${encodeURIComponent(input.rawInput)}&scanLog=saved`);
}

export async function ignoreBarcodeScanLogForContext(options: {
  context: ActiveClinicContext;
  logId: string;
  resolvedNote: string | null;
}) {
  return prisma.barcodeScanLog.updateMany({
    where: {
      id: options.logId,
      clinicId: options.context.clinicId,
      resolveStatus: "UNRESOLVED",
      matchType: {
        in: [...unresolvedResolveMatchTypes],
      },
    },
    data: {
      resolveStatus: "RESOLVED_IGNORED",
      resolvedAt: new Date(),
      resolvedByUserId: options.context.userId,
      resolvedNote: options.resolvedNote,
    },
  });
}

function sampleRecordFromLog(log: {
  sampleJanCode: string | null;
  sampleProductName: string | null;
  sampleManufacturer: string | null;
  sampleSourceFile: string | null;
  sampleSourceSheet: string | null;
  sampleSourceRow: number | null;
  sampleJmdnCode: string | null;
  sampleGenericName: string | null;
}): MedicalDeviceSampleRecord {
  if (!log.sampleJanCode || !log.sampleProductName) {
    throw new Error("取込サンプル情報が不足しています。");
  }

  return {
    sourceFile: log.sampleSourceFile ?? "読み取り履歴",
    sourceSheet: log.sampleSourceSheet ?? "未設定",
    sourceRow: log.sampleSourceRow ?? 1,
    janCode: log.sampleJanCode,
    productName: log.sampleProductName,
    productNameKana: "",
    manufacturer: log.sampleManufacturer ?? "",
    packageUnit: "",
    jmdnCode: log.sampleJmdnCode ?? "",
    genericName: log.sampleGenericName ?? "",
    approvalNumber: "",
    productNumber: "",
    classCategory: "",
    note: "バーコード読み取り履歴の取込サンプル一致から作成",
    isDuplicateJan: false,
  };
}

export async function promoteBarcodeScanLogForContext(options: {
  context: ActiveClinicContext;
  logId: string;
  findSampleRecord?: typeof findMedicalDeviceSampleRecord;
}) {
  const log = await prisma.barcodeScanLog.findFirst({
    where: {
      id: options.logId,
      clinicId: options.context.clinicId,
      resolveStatus: "UNRESOLVED",
    },
    select: {
      id: true,
      matchType: true,
      sampleJanCode: true,
      sampleProductName: true,
      sampleManufacturer: true,
      sampleSourceFile: true,
      sampleSourceSheet: true,
      sampleSourceRow: true,
      sampleJmdnCode: true,
      sampleGenericName: true,
    },
  });

  if (!log) {
    throw new Error("対象の読み取り履歴が見つかりません。");
  }

  if (log.matchType !== "SAMPLE") {
    throw new Error("取込サンプル一致の読み取り履歴だけ商品化できます。");
  }

  if (!log.sampleJanCode) {
    throw new Error("JANコードがないため商品化できません。");
  }

  const findSampleRecord = options.findSampleRecord ?? findMedicalDeviceSampleRecord;
  const sampleFromCache =
    log.sampleSourceFile && log.sampleSourceRow
      ? await findSampleRecord({
          janCode: log.sampleJanCode,
          sourceFile: log.sampleSourceFile,
          sourceRow: log.sampleSourceRow,
        })
      : null;
  const sample = sampleFromCache ?? sampleRecordFromLog(log);
  const productId = await createOrFindTestProductFromSampleForContext({
    organizationId: options.context.organizationId,
    clinicId: options.context.clinicId,
    sample,
  });

  await prisma.barcodeScanLog.updateMany({
    where: {
      id: log.id,
      clinicId: options.context.clinicId,
      resolveStatus: "UNRESOLVED",
      matchType: "SAMPLE",
    },
    data: {
      productId,
      resolveStatus: "RESOLVED_PROMOTED",
      resolvedAt: new Date(),
      resolvedByUserId: options.context.userId,
      resolvedNote: "取込サンプルからローカル検証用商品として追加",
    },
  });

  return productId;
}

export async function markMatchingBarcodeScanLogsLinkedForContext(options: {
  context: ActiveClinicContext;
  barcode: string;
  db?: Prisma.TransactionClient;
}) {
  const inputBarcode = options.barcode.trim();

  if (!inputBarcode) {
    return {
      count: 0,
    };
  }

  const analysis = analyzeBarcodeInput(inputBarcode);
  const candidates = uniqueValues([
    inputBarcode,
    analysis.normalizedInput,
    analysis.extractedBarcode,
    analysis.extractedJan13,
    analysis.extractedGtin,
  ]);
  const db = options.db ?? prisma;

  if (candidates.length === 0) {
    return {
      count: 0,
    };
  }

  return db.barcodeScanLog.updateMany({
    where: {
      clinicId: options.context.clinicId,
      resolveStatus: "UNRESOLVED",
      matchType: {
        in: [...unresolvedResolveMatchTypes],
      },
      OR: [
        {
          rawInput: {
            in: candidates,
          },
        },
        {
          extractedBarcode: {
            in: candidates,
          },
        },
        {
          extractedJan13: {
            in: candidates,
          },
        },
        {
          extractedGtin: {
            in: candidates,
          },
        },
        {
          sampleJanCode: {
            in: candidates,
          },
        },
      ],
    },
    data: {
      resolveStatus: "RESOLVED_LINKED",
      resolvedAt: new Date(),
      resolvedByUserId: options.context.userId,
      resolvedNote: "既存商品へバーコードを紐づけ",
    },
  });
}

export async function ignoreBarcodeScanLogAction(formData: FormData) {
  const context = await requireActiveClinic();
  const input = resolveBarcodeScanLogSchema.parse({
    logId: formData.get("logId"),
    resolvedNote: formData.get("resolvedNote") ?? "",
  });

  await ignoreBarcodeScanLogForContext({
    context,
    logId: input.logId,
    resolvedNote: input.resolvedNote,
  });

  revalidateBarcodeScanLogPages();
}

export async function promoteBarcodeScanLogFromSampleAction(formData: FormData) {
  const context = await requireActiveClinic();
  const input = promoteBarcodeScanLogSchema.parse({
    logId: formData.get("logId"),
  });
  const productId = await promoteBarcodeScanLogForContext({
    context,
    logId: input.logId,
  });

  revalidateBarcodeScanLogPages();
  revalidatePath("/home");
  revalidatePath("/inventory");
  revalidatePath("/shortage");
  revalidatePath("/products");
  revalidatePath("/imports/medical-devices");

  redirect(`/products/${productId}`);
}
