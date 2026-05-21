import { prisma } from "@/lib/db/prisma";

export type ProductImportHistoryRow = {
  id: string;
  sourceType: string;
  fileName: string | null;
  totalRows: number;
  validRows: number;
  createdRows: number;
  skippedRows: number;
  errorRows: number;
  warningRows: number;
  userName: string;
  createdAt: Date;
};

export async function getRecentProductImportHistories(
  organizationId: string,
  take = 10,
): Promise<ProductImportHistoryRow[]> {
  const rows = await prisma.productImportHistory.findMany({
    where: {
      organizationId,
    },
    include: {
      user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take,
  });

  return rows.map((row) => ({
    id: row.id,
    sourceType: row.sourceType,
    fileName: row.fileName,
    totalRows: row.totalRows,
    validRows: row.validRows,
    createdRows: row.createdRows,
    skippedRows: row.skippedRows,
    errorRows: row.errorRows,
    warningRows: row.warningRows,
    userName: row.user.name,
    createdAt: row.createdAt,
  }));
}
