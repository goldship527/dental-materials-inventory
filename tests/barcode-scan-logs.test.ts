import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { resetTestDatabase } from "./helpers/db";

const productJan = "4900000100019";
const sampleJan = "4900000123456";
const noMatchJan = "4900000888882";
const multiMatchJan = "4900000999990";
const gs1ProductInput = `(01)0${productJan}(17)270531(10)LOT123(21)SER01`;

async function seedTestData(prisma: PrismaClient) {
  const organization = await prisma.organization.create({
    data: {
      name: "テスト用法人",
    },
  });

  const [clinic, otherClinic] = await Promise.all([
    prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "テスト用クリニックA",
      },
    }),
    prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "テスト用クリニックB",
      },
    }),
  ]);

  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "テストユーザー",
      email: "barcode-scan-log-test@example.com",
      passwordHash: "test-password-hash",
    },
  });

  await prisma.userClinicAssignment.create({
    data: {
      userId: user.id,
      clinicId: clinic.id,
    },
  });

  const product = await prisma.product.create({
    data: {
      organizationId: organization.id,
      productCode: "TEST-BARCODE-001",
      janCode: productJan,
      name: "テスト用商品",
      category: "テストカテゴリ",
      defaultMinStock: 1,
    },
  });

  await prisma.stockItem.create({
    data: {
      clinicId: clinic.id,
      productId: product.id,
      quantity: 3,
      minStock: 1,
      location: "テスト棚",
    },
  });

  const multiProductByJan = await prisma.product.create({
    data: {
      organizationId: organization.id,
      productCode: "TEST-MULTI-A",
      janCode: multiMatchJan,
      name: "複数候補テスト商品A",
      category: "テストカテゴリ",
      defaultMinStock: 1,
    },
  });

  const multiProductByBarcode = await prisma.product.create({
    data: {
      organizationId: organization.id,
      productCode: "TEST-MULTI-B",
      name: "複数候補テスト商品B",
      category: "テストカテゴリ",
      defaultMinStock: 1,
    },
  });

  await prisma.stockItem.createMany({
    data: [
      {
        clinicId: clinic.id,
        productId: multiProductByJan.id,
        quantity: 1,
        minStock: 1,
        location: "テスト棚",
      },
      {
        clinicId: clinic.id,
        productId: multiProductByBarcode.id,
        quantity: 1,
        minStock: 1,
        location: "テスト棚",
      },
    ],
  });

  await prisma.productBarcode.create({
    data: {
      organizationId: organization.id,
      productId: multiProductByBarcode.id,
      barcode: multiMatchJan,
      barcodeType: "JAN",
      unitLabel: "箱",
      isPrimary: true,
    },
  });

  return {
    organization,
    clinic,
    otherClinic,
    user,
    product,
  };
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const {
    createBarcodeScanLogForContext,
    ignoreBarcodeScanLogForContext,
    markMatchingBarcodeScanLogsLinkedForContext,
    promoteBarcodeScanLogForContext,
  } = await import("../src/lib/actions/barcode-scan-logs");
  const { getRecentBarcodeScanLogRows, getUnresolvedBarcodeScanLogRows } = await import("../src/lib/db/barcode-scan-logs");
  const data = await seedTestData(prisma);
  const context = {
    userId: data.user.id,
    userName: data.user.name,
    organizationId: data.organization.id,
    clinicId: data.clinic.id,
    clinicName: data.clinic.name,
  };
  const sampleRecord = {
    sourceFile: "test-source.xls",
    sourceSheet: "Sheet1",
    sourceRow: 12,
    janCode: sampleJan,
    productName: "サンプル一致テスト商品",
    productNameKana: "サンプルイッチテストショウヒン",
    manufacturer: "テストメーカー",
    packageUnit: "箱",
    jmdnCode: "99999999",
    genericName: "テスト一般的名称",
    approvalNumber: "TEST-APPROVAL",
    productNumber: "TEST-PRODUCT-NUMBER",
    classCategory: "テスト分類",
    note: "テスト用",
    isDuplicateJan: false,
  };
  const findSampleRecordsByJan = async (janCode: string) => (janCode === sampleJan ? [sampleRecord] : []);

  try {
    const productLog = await createBarcodeScanLogForContext({
      context,
      rawInput: `${productJan} 2024/12/16 11:57`,
      findSampleRecordsByJan,
    });

    assert.equal(productLog.matchType, "PRODUCT");
    assert.equal(productLog.resolveStatus, "UNRESOLVED");
    assert.equal(productLog.productId, data.product.id);
    assert.equal(productLog.clinicId, data.clinic.id);
    assert.equal(productLog.extractedJan13, productJan);
    assert.equal(productLog.lotNumber, null);
    assert.equal(productLog.serialNumber, null);
    assert.equal(productLog.expiryDateText, null);
    assert.equal(productLog.expiryDate, null);

    const currentClinicStock = await prisma.stockItem.findUnique({
      where: {
        clinicId_productId: {
          clinicId: data.clinic.id,
          productId: productLog.productId ?? "",
        },
      },
    });

    assert.notEqual(currentClinicStock, null);

    const gs1Log = await createBarcodeScanLogForContext({
      context,
      rawInput: gs1ProductInput,
      findSampleRecordsByJan,
    });

    assert.equal(gs1Log.matchType, "NO_MATCH");
    assert.equal(gs1Log.productId, null);
    assert.equal(gs1Log.lotNumber, "LOT123");
    assert.equal(gs1Log.serialNumber, "SER01");
    assert.equal(gs1Log.expiryDateText, "270531");
    assert.ok(gs1Log.expiryDate instanceof Date);
    assert.equal(gs1Log.expiryDate.getFullYear(), 2027);
    assert.equal(gs1Log.expiryDate.getMonth(), 4);
    assert.equal(gs1Log.expiryDate.getDate(), 31);

    const sampleLog = await createBarcodeScanLogForContext({
      context,
      rawInput: sampleJan,
      findSampleRecordsByJan,
    });

    assert.equal(sampleLog.matchType, "SAMPLE");
    assert.equal(sampleLog.resolveStatus, "UNRESOLVED");
    assert.equal(sampleLog.productId, null);
    assert.equal(sampleLog.sampleJanCode, sampleJan);
    assert.equal(sampleLog.sampleProductName, sampleRecord.productName);
    assert.equal(sampleLog.sampleSourceFile, sampleRecord.sourceFile);
    assert.equal(sampleLog.sampleSourceRow, sampleRecord.sourceRow);
    assert.equal(sampleLog.sampleJmdnCode, sampleRecord.jmdnCode);
    assert.equal(sampleLog.sampleGenericName, sampleRecord.genericName);

    const noMatchLog = await createBarcodeScanLogForContext({
      context,
      rawInput: noMatchJan,
      findSampleRecordsByJan,
    });

    assert.equal(noMatchLog.matchType, "NO_MATCH");
    assert.equal(noMatchLog.resolveStatus, "UNRESOLVED");
    assert.equal(noMatchLog.productId, null);
    assert.equal(noMatchLog.sampleJanCode, null);

    const multiLog = await createBarcodeScanLogForContext({
      context,
      rawInput: multiMatchJan,
      findSampleRecordsByJan,
    });

    assert.equal(multiLog.matchType, "PRODUCT_MULTI");
    assert.equal(multiLog.resolveStatus, "UNRESOLVED");
    assert.equal(multiLog.productId, null);

    await assert.rejects(
      () =>
        promoteBarcodeScanLogForContext({
          context,
          logId: noMatchLog.id,
          findSampleRecord: async () => sampleRecord,
        }),
      /取込サンプル一致/,
    );

    const otherClinicLog = await prisma.barcodeScanLog.create({
      data: {
        clinicId: data.otherClinic.id,
        userId: data.user.id,
        rawInput: "OTHER-CLINIC-LOG",
        matchType: "NO_MATCH",
      },
    });

    const currentClinicRows = await getRecentBarcodeScanLogRows(data.clinic.id);

    assert.equal(currentClinicRows.some((row) => row.id === otherClinicLog.id), false);
    assert.ok(currentClinicRows.length >= 4);
    assert.ok(currentClinicRows.every((row) => row.id !== otherClinicLog.id));

    const unresolvedRows = await getUnresolvedBarcodeScanLogRows(data.clinic.id);

    assert.equal(unresolvedRows.some((row) => row.id === noMatchLog.id), true);
    assert.equal(unresolvedRows.some((row) => row.id === multiLog.id), true);
    assert.equal(unresolvedRows.some((row) => row.id === productLog.id), false);
    assert.equal(unresolvedRows.some((row) => row.id === sampleLog.id), true);
    assert.equal(unresolvedRows.some((row) => row.id === otherClinicLog.id), false);

    const stockBeforeIgnore = await prisma.stockItem.count({
      where: {
        clinicId: data.clinic.id,
      },
    });

    await ignoreBarcodeScanLogForContext({
      context,
      logId: noMatchLog.id,
      resolvedNote: "テストで無視",
    });

    const stockAfterIgnore = await prisma.stockItem.count({
      where: {
        clinicId: data.clinic.id,
      },
    });
    const ignoredLog = await prisma.barcodeScanLog.findUniqueOrThrow({
      where: {
        id: noMatchLog.id,
      },
    });

    assert.equal(stockAfterIgnore, stockBeforeIgnore);
    assert.equal(ignoredLog.resolveStatus, "RESOLVED_IGNORED");
    assert.notEqual(ignoredLog.resolvedAt, null);
    assert.equal(ignoredLog.resolvedByUserId, data.user.id);
    assert.equal(ignoredLog.resolvedNote, "テストで無視");

    const promotedProductId = await promoteBarcodeScanLogForContext({
      context,
      logId: sampleLog.id,
      findSampleRecord: async () => sampleRecord,
    });
    const promotedLog = await prisma.barcodeScanLog.findUniqueOrThrow({
      where: {
        id: sampleLog.id,
      },
    });
    const promotedProduct = await prisma.product.findUnique({
      where: {
        id: promotedProductId,
      },
    });

    assert.equal(promotedLog.resolveStatus, "RESOLVED_PROMOTED");
    assert.equal(promotedLog.productId, promotedProductId);
    assert.notEqual(promotedProduct, null);

    await markMatchingBarcodeScanLogsLinkedForContext({
      context,
      barcode: multiMatchJan,
    });

    const linkedLog = await prisma.barcodeScanLog.findUniqueOrThrow({
      where: {
        id: multiLog.id,
      },
    });

    assert.equal(linkedLog.resolveStatus, "RESOLVED_LINKED");
    assert.notEqual(linkedLog.resolvedAt, null);
    assert.equal(linkedLog.resolvedByUserId, data.user.id);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
