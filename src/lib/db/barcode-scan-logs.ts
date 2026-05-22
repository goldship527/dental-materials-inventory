import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type BarcodeScanLogRow = {
  id: string;
  rawInput: string;
  extractedBarcode: string | null;
  extractedJan13: string | null;
  extractedGtin: string | null;
  scannedAtText: string | null;
  scannedAt: Date | null;
  lotNumber: string | null;
  serialNumber: string | null;
  expiryDateText: string | null;
  expiryDate: Date | null;
  matchType: string;
  sampleJanCode: string | null;
  sampleProductName: string | null;
  sampleManufacturer: string | null;
  sampleSourceFile: string | null;
  sampleSourceSheet: string | null;
  sampleSourceRow: number | null;
  sampleJmdnCode: string | null;
  sampleGenericName: string | null;
  resolveStatus: string;
  resolvedAt: Date | null;
  resolvedByUserId: string | null;
  resolvedNote: string | null;
  createdAt: Date;
  userName: string;
  productId: string | null;
  productName: string | null;
  productCode: string | null;
};

export function getBarcodeScanMatchTypeLabel(matchType: string) {
  if (matchType === "PRODUCT") {
    return "商品一致";
  }

  if (matchType === "PRODUCT_MULTI") {
    return "商品候補複数";
  }

  if (matchType === "SAMPLE") {
    return "取込サンプル一致";
  }

  return "未一致";
}

export function getBarcodeScanResolveStatusLabel(resolveStatus: string) {
  if (resolveStatus === "RESOLVED_LINKED") {
    return "紐づけ済";
  }

  if (resolveStatus === "RESOLVED_PROMOTED") {
    return "商品化";
  }

  if (resolveStatus === "RESOLVED_IGNORED") {
    return "無視";
  }

  return "未対応";
}

export function getBarcodeScanResolveStatusClass(resolveStatus: string) {
  if (resolveStatus === "RESOLVED_LINKED") {
    return "bg-green-50 text-success";
  }

  if (resolveStatus === "RESOLVED_PROMOTED") {
    return "bg-teal-50 text-accent";
  }

  if (resolveStatus === "RESOLVED_IGNORED") {
    return "bg-gray-100 text-muted";
  }

  return "bg-orange-50 text-warning";
}

const barcodeScanLogRowInclude = {
  user: {
    select: {
      name: true,
    },
  },
  product: {
    select: {
      id: true,
      name: true,
      productCode: true,
    },
  },
} satisfies Prisma.BarcodeScanLogInclude;

type BarcodeScanLogWithRelations = Prisma.BarcodeScanLogGetPayload<{
  include: typeof barcodeScanLogRowInclude;
}>;

function toBarcodeScanLogRow(log: BarcodeScanLogWithRelations): BarcodeScanLogRow {
  return {
    id: log.id,
    rawInput: log.rawInput,
    extractedBarcode: log.extractedBarcode,
    extractedJan13: log.extractedJan13,
    extractedGtin: log.extractedGtin,
    scannedAtText: log.scannedAtText,
    scannedAt: log.scannedAt,
    lotNumber: log.lotNumber,
    serialNumber: log.serialNumber,
    expiryDateText: log.expiryDateText,
    expiryDate: log.expiryDate,
    matchType: log.matchType,
    sampleJanCode: log.sampleJanCode,
    sampleProductName: log.sampleProductName,
    sampleManufacturer: log.sampleManufacturer,
    sampleSourceFile: log.sampleSourceFile,
    sampleSourceSheet: log.sampleSourceSheet,
    sampleSourceRow: log.sampleSourceRow,
    sampleJmdnCode: log.sampleJmdnCode,
    sampleGenericName: log.sampleGenericName,
    resolveStatus: log.resolveStatus,
    resolvedAt: log.resolvedAt,
    resolvedByUserId: log.resolvedByUserId,
    resolvedNote: log.resolvedNote,
    createdAt: log.createdAt,
    userName: log.user.name,
    productId: log.product?.id ?? null,
    productName: log.product?.name ?? null,
    productCode: log.product?.productCode ?? null,
  };
}

export async function getRecentBarcodeScanLogRows(
  clinicId: string,
  options?: {
    resolveStatus?: string;
  },
): Promise<BarcodeScanLogRow[]> {
  const logs = await prisma.barcodeScanLog.findMany({
    where: {
      clinicId,
      resolveStatus: options?.resolveStatus,
    },
    include: barcodeScanLogRowInclude,
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  return logs.map(toBarcodeScanLogRow);
}

export async function getUnresolvedBarcodeScanLogRows(clinicId: string): Promise<BarcodeScanLogRow[]> {
  const logs = await prisma.barcodeScanLog.findMany({
    where: {
      clinicId,
      resolveStatus: "UNRESOLVED",
      matchType: {
        in: ["NO_MATCH", "PRODUCT_MULTI", "SAMPLE"],
      },
    },
    include: barcodeScanLogRowInclude,
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  return logs.map(toBarcodeScanLogRow);
}
