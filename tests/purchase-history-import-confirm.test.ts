import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

function buildCsv(rows: string[][]) {
  return [
    "purchaseDate,dealerName,dealerProductCode,supplierProductCode,janCode,productName,manufacturer,specification,quantity,unitPrice,amount",
    ...rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const {
    importPurchaseHistoryProductsForContext,
    previewPurchaseHistoryImportForContext,
  } = await import("../src/lib/actions/purchase-history-import");
  const { buildProductNamesByIdForPreview } = await import("../src/lib/purchase-history/product-name-map");
  const { parsePurchaseHistoryReviewDecisionsJson } = await import("../src/lib/purchase-history/review-decisions");

  try {
    const organization = await prisma.organization.create({
      data: {
        name: "Purchase History Import Organization",
      },
    });
    const otherOrganization = await prisma.organization.create({
      data: {
        name: "Other Purchase History Import Organization",
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Purchase History Import User",
        email: "purchase-history-import-user@example.test",
        passwordHash: "test",
        role: "ADMIN",
        isActive: true,
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Purchase History Import Clinic",
      },
    });
    await prisma.userClinicAssignment.create({
      data: {
        userId: user.id,
        clinicId: clinic.id,
      },
    });
    const supplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: "Sample Dealer",
      },
    });

    await prisma.product.createMany({
      data: [
        {
          organizationId: organization.id,
          name: "Existing Bond",
          janCode: "4900000000001",
          defaultMinStock: 1,
        },
        {
          organizationId: organization.id,
          name: "Flow Composite A1",
          manufacturer: "Sample Maker",
          defaultMinStock: 1,
        },
        {
          organizationId: organization.id,
          name: "Unrelated Product",
          manufacturer: "Sample Maker",
          defaultMinStock: 1,
        },
        {
          organizationId: otherOrganization.id,
          name: "Other Organization Bond",
          janCode: "4900000000777",
          defaultMinStock: 1,
        },
      ],
    });

    const otherOrganizationPreview = await previewPurchaseHistoryImportForContext({
      organizationId: organization.id,
      sourceText: buildCsv([
        ["2026-05-01", "Sample Dealer", "", "", "4900000000777", "Other Organization Bond", "Sample Maker", "pack", "1", "100", "100"],
      ]),
      sourceType: "CSV",
    });

    assert.equal(otherOrganizationPreview.summary.createRows, 1);
    assert.equal(otherOrganizationPreview.summary.existingRows, 0);
    assert.equal(otherOrganizationPreview.rows[0]?.matchedProductId, null);

    const sourceText = buildCsv([
      ["2026-05-01", "Sample Dealer", "DLR-001", "SUP-001", "4900000000001", "Existing Bond", "Sample Maker", "5ml", "2", "1200", "2400"],
      ["2026-05-02", "Sample Dealer", "DLR-002", "SUP-002", "", "New Impression Material", "Sample Maker", "regular", "3", "2500", "7500"],
      ["2026-05-03", "Sample Dealer", "DLR-003", "SUP-003", "4900000000999", "Duplicate New Item", "Sample Maker", "pack", "1", "500", "500"],
      ["2026-05-04", "Sample Dealer", "DLR-004", "SUP-004", "4900000000999", "Duplicate New Item", "Sample Maker", "pack", "2", "500", "1000"],
      ["2026-05-05", "Sample Dealer", "DLR-005", "SUP-005", "", "Flow Composite", "Sample Maker", "syringe", "1", "1500", "1500"],
    ]);
    const preview = await previewPurchaseHistoryImportForContext({
      organizationId: organization.id,
      sourceText,
      sourceType: "CSV",
    });

    assert.equal(preview.summary.totalRows, 5);
    assert.equal(preview.summary.existingRows, 1);
    assert.equal(preview.summary.createRows, 3);
    assert.equal(preview.summary.needsReviewRows, 1);
    assert.equal(preview.summary.errorRows, 0);
    const existingProductsForNameMap = await prisma.product.findMany({
      where: {
        organizationId: organization.id,
      },
      select: {
        id: true,
        name: true,
        janCode: true,
        manufacturer: true,
        productCode: true,
      },
    });
    const productNamesById = buildProductNamesByIdForPreview(
      existingProductsForNameMap.map((product) => ({
        ...product,
        barcodes: [],
        supplierProductCodes: [],
      })),
      preview,
    );

    assert.equal(Object.values(productNamesById).includes("Existing Bond"), true);
    assert.equal(Object.values(productNamesById).includes("Flow Composite A1"), true);
    assert.equal(Object.values(productNamesById).includes("Unrelated Product"), false);

    const result = await importPurchaseHistoryProductsForContext({
      organizationId: organization.id,
      clinicId: clinic.id,
      userId: user.id,
      sourceText,
      sourceType: "CSV",
      fileName: "purchase-history.csv",
      reviewDecisions: {
        6: "EXISTING",
      },
    });
    const createdProducts = await prisma.product.findMany({
      where: {
        organizationId: organization.id,
        name: {
          in: ["New Impression Material", "Duplicate New Item"],
        },
      },
      orderBy: {
        name: "asc",
      },
    });
    const stockItems = await prisma.stockItem.count({
      where: {
        productId: {
          in: createdProducts.map((product) => product.id),
        },
      },
    });
    const history = await prisma.productImportHistory.findFirstOrThrow({
      where: {
        organizationId: organization.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId: organization.id,
        action: "PURCHASE_HISTORY_IMPORT",
      },
    });

    assert.equal(result.createdRows, 2);
    assert.equal(result.skippedRows, 3);
    assert.equal(createdProducts.length, 2);
    assert.equal(createdProducts.every((product) => product.primarySupplierId === supplier.id), true);
    assert.equal(createdProducts.every((product) => product.productCode === null), true);
    assert.deepEqual(
      createdProducts.map((product) => product.supplierProductCode),
      ["SUP-003", "SUP-002"],
    );
    assert.equal(createdProducts.every((product) => product.defaultMinStock === 0), true);
    assert.equal(createdProducts.every((product) => product.importSource === "PURCHASE_HISTORY"), true);
    assert.equal(createdProducts.every((product) => !product.notes?.includes("[purchase-history-import]")), true);
    assert.equal(stockItems, 0);
    assert.equal(history.clinicId, clinic.id);
    assert.equal(history.sourceType, "PURCHASE_HISTORY_CSV");
    assert.equal(history.fileName, "purchase-history.csv");
    assert.deepEqual(JSON.parse(history.dealerNames ?? "[]"), ["Sample Dealer"]);
    assert.equal(history.totalRows, 5);
    assert.equal(history.createdRows, 2);
    assert.equal(history.skippedRows, 3);
    assert.equal(auditLog.targetType, "Product");
    assert.deepEqual((auditLog.detailsJson as { dealerNames?: string[] }).dealerNames, ["Sample Dealer"]);
    assert.equal((auditLog.detailsJson as { clinicId?: string }).clinicId, clinic.id);

    const reviewSourceText = buildCsv([
      ["2026-05-07", "Sample Dealer", "DLR-007", "SUP-007", "", "Flow Composite", "Sample Maker", "syringe", "1", "1500", "1500"],
    ]);
    const reviewPreview = await previewPurchaseHistoryImportForContext({
      organizationId: organization.id,
      sourceText: reviewSourceText,
      sourceType: "CSV",
    });

    assert.equal(reviewPreview.summary.needsReviewRows, 1);

    await assert.rejects(
      () =>
        importPurchaseHistoryProductsForContext({
          organizationId: organization.id,
          userId: user.id,
          sourceText: reviewSourceText,
          sourceType: "CSV",
          fileName: "purchase-history-review-missing.csv",
        }),
      /確認必要行の扱いが未選択です/,
    );

    const reviewExistingResult = await importPurchaseHistoryProductsForContext({
      organizationId: organization.id,
      userId: user.id,
      sourceText: reviewSourceText,
      sourceType: "CSV",
      fileName: "purchase-history-review-existing.csv",
      reviewDecisions: {
        2: "EXISTING",
      },
    });
    const reviewExcludeResult = await importPurchaseHistoryProductsForContext({
      organizationId: organization.id,
      userId: user.id,
      sourceText: reviewSourceText,
      sourceType: "CSV",
      fileName: "purchase-history-review-exclude.csv",
      reviewDecisions: {
        2: "EXCLUDE",
      },
    });
    const reviewProductCountBeforeCreate = await prisma.product.count({
      where: {
        organizationId: organization.id,
        name: "Flow Composite",
      },
    });

    assert.equal(reviewExistingResult.createdRows, 0);
    assert.equal(reviewExcludeResult.createdRows, 0);
    assert.equal(reviewProductCountBeforeCreate, 0);

    const reviewCreateResult = await importPurchaseHistoryProductsForContext({
      organizationId: organization.id,
      userId: user.id,
      sourceText: reviewSourceText,
      sourceType: "CSV",
      fileName: "purchase-history-review.csv",
      reviewDecisions: {
        2: "CREATE",
      },
    });
    const reviewCreatedProduct = await prisma.product.findFirstOrThrow({
      where: {
        organizationId: organization.id,
        name: "Flow Composite",
      },
    });

    assert.equal(reviewCreateResult.createdRows, 1);
    assert.equal(reviewCreatedProduct.primarySupplierId, supplier.id);
    assert.equal(reviewCreatedProduct.productCode, null);
    assert.equal(reviewCreatedProduct.supplierProductCode, "SUP-007");
    assert.equal(reviewCreatedProduct.importSource, "PURCHASE_HISTORY");

    assert.throws(
      () => parsePurchaseHistoryReviewDecisionsJson("{invalid-json"),
      /確認必要行の選択内容を読み取れませんでした/,
    );

    await assert.rejects(
      () =>
        importPurchaseHistoryProductsForContext({
          organizationId: organization.id,
          userId: user.id,
          sourceText: buildCsv([["2026-05-06", "Sample Dealer", "", "", "", "Invalid Row", "Sample Maker", "pack", "1", "100", "100"]]),
          sourceType: "CSV",
        }),
      /エラー行/,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
