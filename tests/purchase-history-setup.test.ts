import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { updatePurchaseHistorySetupForContext } = await import("../src/lib/actions/purchase-history-setup");
  const { getPurchaseHistorySetupProductRows } = await import("../src/lib/db/products");
  const { parsePurchaseHistorySetupItemsJson } = await import("../src/lib/purchase-history/setup-items");

  try {
    const organization = await prisma.organization.create({
      data: {
        name: "Purchase History Setup Organization",
      },
    });
    const otherOrganization = await prisma.organization.create({
      data: {
        name: "Other Purchase History Setup Organization",
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Purchase History Setup User",
        email: "purchase-history-setup-user@example.test",
        passwordHash: "test",
        role: "ADMIN",
        isActive: true,
      },
    });
    const setupProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Purchase History Setup Product",
        category: "未分類",
        defaultMinStock: 0,
        importSource: "PURCHASE_HISTORY",
        notes: "購入履歴から登録 [purchase-history-import]",
      },
    });
    const regularProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Regular Product",
        category: "未分類",
        defaultMinStock: 0,
        notes: "manual",
      },
    });
    const configuredPurchaseHistoryProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Configured Purchase History Product",
        category: "印象材",
        defaultMinStock: 2,
        importSource: "PURCHASE_HISTORY",
        notes: "購入履歴から登録 [purchase-history-import]",
      },
    });
    const otherProduct = await prisma.product.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Organization Product",
        category: "未分類",
        defaultMinStock: 0,
        importSource: "PURCHASE_HISTORY",
        notes: "購入履歴から登録 [purchase-history-import]",
      },
    });
    const notesOnlyProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Notes Only Purchase History Marker Product",
        category: "未分類",
        defaultMinStock: 0,
        notes: "購入履歴から登録 [purchase-history-import]",
      },
    });
    const context = {
      userId: user.id,
      organizationId: organization.id,
    };
    const setupRowsBefore = await getPurchaseHistorySetupProductRows(organization.id);

    assert.deepEqual(setupRowsBefore.map((row) => row.id), [setupProduct.id]);
    assert.equal(setupRowsBefore.some((row) => row.id === notesOnlyProduct.id), false);

    const result = await updatePurchaseHistorySetupForContext(context, [
      {
        productId: setupProduct.id,
        category: "印象材",
        defaultMinStock: 3,
      },
    ]);
    const updatedProduct = await prisma.product.findUniqueOrThrow({
      where: {
        id: setupProduct.id,
      },
    });
    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId: organization.id,
        action: "PURCHASE_HISTORY_SETUP",
      },
    });
    const setupRowsAfter = await getPurchaseHistorySetupProductRows(organization.id);

    assert.equal(result.updatedRows, 1);
    assert.equal(updatedProduct.category, "印象材");
    assert.equal(updatedProduct.defaultMinStock, 3);
    assert.equal(auditLog.targetType, "Product");
    assert.deepEqual((auditLog.detailsJson as { productIds?: string[] }).productIds, [setupProduct.id]);
    assert.equal(setupRowsAfter.length, 0);

    const setupProductForMixedReject = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Purchase History Mixed Reject Product",
        category: "未分類",
        defaultMinStock: 0,
        importSource: "PURCHASE_HISTORY",
        notes: "購入履歴から登録 [purchase-history-import]",
      },
    });

    await assert.rejects(
      () =>
        updatePurchaseHistorySetupForContext(context, [
          {
            productId: setupProductForMixedReject.id,
            category: "消耗品",
            defaultMinStock: 4,
          },
          {
            productId: regularProduct.id,
            category: "消耗品",
            defaultMinStock: 2,
          },
        ]),
      /対象外の商品/,
    );

    const mixedRejectProduct = await prisma.product.findUniqueOrThrow({
      where: {
        id: setupProductForMixedReject.id,
      },
    });
    const auditLogCountAfterMixedReject = await prisma.auditLog.count({
      where: {
        organizationId: organization.id,
        action: "PURCHASE_HISTORY_SETUP",
      },
    });

    assert.equal(mixedRejectProduct.category, "未分類");
    assert.equal(mixedRejectProduct.defaultMinStock, 0);
    assert.equal(auditLogCountAfterMixedReject, 1);

    const setupProductForDuplicateItems = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Purchase History Duplicate Items Product",
        category: "未分類",
        defaultMinStock: 0,
        importSource: "PURCHASE_HISTORY",
      },
    });
    const duplicateItemsResult = await updatePurchaseHistorySetupForContext(context, [
      {
        productId: setupProductForDuplicateItems.id,
        category: "印象材",
        defaultMinStock: 2,
      },
      {
        productId: setupProductForDuplicateItems.id,
        category: "消耗品",
        defaultMinStock: 5,
      },
    ]);
    const duplicateItemsProduct = await prisma.product.findUniqueOrThrow({
      where: {
        id: setupProductForDuplicateItems.id,
      },
    });

    assert.equal(duplicateItemsResult.updatedRows, 1);
    assert.equal(duplicateItemsProduct.category, "消耗品");
    assert.equal(duplicateItemsProduct.defaultMinStock, 5);

    assert.throws(
      () => parsePurchaseHistorySetupItemsJson("{invalid-json"),
      /一括整備の入力内容を読み取れませんでした/,
    );
    assert.throws(
      () =>
        parsePurchaseHistorySetupItemsJson(
          JSON.stringify(
            Array.from({ length: 201 }, (_, index) => ({
              productId: `product-${index}`,
              category: "消耗品",
              defaultMinStock: 1,
            })),
          ),
        ),
      /一度に更新できる商品は200件までです/,
    );

    await assert.rejects(
      () =>
        updatePurchaseHistorySetupForContext(context, [
          {
            productId: "missing-product-id",
            category: "消耗品",
            defaultMinStock: 2,
          },
        ]),
      /対象外の商品/,
    );

    const setupProductForEmptyCategory = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Purchase History Empty Category Product",
        category: "未分類",
        defaultMinStock: 0,
        importSource: "PURCHASE_HISTORY",
      },
    });
    const emptyCategoryItems = parsePurchaseHistorySetupItemsJson(
      JSON.stringify([
        {
          productId: setupProductForEmptyCategory.id,
          category: "",
          defaultMinStock: 6,
        },
      ]),
    );
    const emptyCategoryResult = await updatePurchaseHistorySetupForContext(context, emptyCategoryItems);
    const emptyCategoryProduct = await prisma.product.findUniqueOrThrow({
      where: {
        id: setupProductForEmptyCategory.id,
      },
    });

    assert.equal(emptyCategoryResult.updatedRows, 1);
    assert.equal(emptyCategoryProduct.category, null);
    assert.equal(emptyCategoryProduct.defaultMinStock, 6);

    await assert.rejects(
      () =>
        updatePurchaseHistorySetupForContext(context, [
          {
            productId: regularProduct.id,
            category: "消耗品",
            defaultMinStock: 2,
          },
        ]),
      /対象外の商品/,
    );

    await assert.rejects(
      () =>
        updatePurchaseHistorySetupForContext(context, [
          {
            productId: notesOnlyProduct.id,
            category: "消耗品",
            defaultMinStock: 2,
          },
        ]),
      /対象外の商品/,
    );

    await assert.rejects(
      () =>
        updatePurchaseHistorySetupForContext(context, [
          {
            productId: configuredPurchaseHistoryProduct.id,
            category: "消耗品",
            defaultMinStock: 2,
          },
        ]),
      /対象外の商品/,
    );

    await assert.rejects(
      () =>
        updatePurchaseHistorySetupForContext(context, [
          {
            productId: otherProduct.id,
            category: "消耗品",
            defaultMinStock: 2,
          },
        ]),
      /対象外の商品/,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
