import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();
  const singleConnectionUrl = new URL(process.env.DATABASE_URL!);
  singleConnectionUrl.searchParams.set("connection_limit", "1");
  process.env.DATABASE_URL = singleConnectionUrl.toString();
  const { prisma } = await import("../src/lib/db/prisma");
  const { issueFromCard } = await import("../src/lib/stock/card-issue");
  const { lockOrderRequestProduct } = await import("../src/lib/orders/locks");
  const { syncOrderSuggestion } = await import("../src/lib/orders/suggestions");
  const { updateOrderRequestQuantityForContext, updateOrderRequestStatusForContext,
    receiveOrderRequestForContext, revertOrderReceiptForContext, markOrderRequestsOrderedForContext } =
    await import("../src/lib/actions/orders");
  const { getActiveOrderRequestProductIds, getOrderRequestRows } = await import("../src/lib/db/orders");
  const { getPrintableOrderRows } = await import("../src/lib/orders/print");

  try {
    const organization = await prisma.organization.create({ data: { name: "架空テスト組織" } });
    const clinic = await prisma.clinic.create({ data: { organizationId: organization.id, name: "架空テスト拠点" } });
    const user = await prisma.user.create({
      data: { organizationId: organization.id, name: "架空利用者", email: "suggestions@example.test", passwordHash: "test" },
    });
    const staff = await prisma.staffOperator.create({
      data: {
        organizationId: organization.id,
        displayName: "架空スタッフ",
        barcode: "SUGGESTION-STAFF",
        clinicAssignments: { create: { clinicId: clinic.id } },
      },
    });
    const context = {
      userId: user.id, userName: user.name, organizationId: organization.id,
      clinicId: clinic.id, clinicName: clinic.name,
    };
    let serial = 0;
    async function fixture(input: { min?: number; quantity?: number; orderUnit?: string | null;
      stockUsageMode?: "NONE" | "OPEN_PACK" | "UNIT_BASED"; isActive?: boolean } = {}) {
      serial += 1;
      const product = await prisma.product.create({
        data: {
          organizationId: organization.id,
          name: `架空商品${serial}`,
          productCode: `FICT-${serial}`,
          defaultMinStock: input.min ?? 5,
          orderUnit: input.orderUnit === undefined ? "箱" : input.orderUnit,
          stockUsageMode: input.stockUsageMode ?? "NONE",
          isActive: input.isActive ?? true,
        },
      });
      const stock = await prisma.stockItem.create({
        data: { clinicId: clinic.id, productId: product.id, quantity: input.quantity ?? 5, minStock: input.min ?? 5 },
      });
      return { product, stock };
    }
    async function suggestion(productId: string) {
      return prisma.orderRequest.findMany({ where: { clinicId: clinic.id, productId, status: "SUGGESTED" } });
    }
    async function resync(productId: string) {
      return prisma.$transaction(async (tx) => {
        await lockOrderRequestProduct(tx, clinic.id, productId);
        return syncOrderSuggestion(tx, {
          clinicId: clinic.id, organizationId: organization.id, productId, actorUserId: user.id,
        });
      });
    }
    async function changeStock(productId: string, delta: number, expectedQuantity?: number) {
      return prisma.$transaction(async (tx) => {
        await lockOrderRequestProduct(tx, clinic.id, productId);
        const current = await tx.stockItem.findUniqueOrThrow({
          where: { clinicId_productId: { clinicId: clinic.id, productId } },
        });
        const updated = await tx.stockItem.updateMany({
          where: { id: current.id, ...(expectedQuantity === undefined ? {} : { quantity: expectedQuantity }) },
          data: { quantity: { increment: delta } },
        });
        if (updated.count !== 1) throw new Error("fictional stock conflict");
        await syncOrderSuggestion(tx, {
          clinicId: clinic.id, organizationId: organization.id, productId, actorUserId: user.id,
        });
      });
    }

    const s1 = await fixture();
    let stock = await prisma.stockItem.findUniqueOrThrow({ where: { id: s1.stock.id } });
    await prisma.$transaction((tx) => issueFromCard(tx, context, {
      stockItemId: stock.id, quantity: 1, expectedQuantity: stock.quantity, expectedUpdatedAt: stock.updatedAt.getTime(),
      expectedUnit: "箱", unitConfirmed: "yes", staffOperatorId: staff.id,
    }));
    assert.equal((await suggestion(s1.product.id))[0]?.requestedQuantity, 1);
    console.log("S1: pass");

    stock = await prisma.stockItem.findUniqueOrThrow({ where: { id: s1.stock.id } });
    await prisma.$transaction((tx) => issueFromCard(tx, context, {
      stockItemId: stock.id, quantity: 1, expectedQuantity: stock.quantity, expectedUpdatedAt: stock.updatedAt.getTime(),
      expectedUnit: "箱", unitConfirmed: "yes", staffOperatorId: staff.id,
    }));
    assert.deepEqual((await suggestion(s1.product.id)).map((row) => row.requestedQuantity), [2]);
    console.log("S2: pass");

    const s3 = await fixture();
    await resync(s3.product.id);
    assert.equal((await suggestion(s3.product.id)).length, 0);
    console.log("S3: pass");

    const s4 = await fixture({ quantity: 2 });
    await prisma.orderRequest.create({ data: {
      clinicId: clinic.id, productId: s4.product.id, status: "ORDERED", requestedQuantity: 2, createdByUserId: user.id,
    } });
    await resync(s4.product.id);
    assert.equal((await suggestion(s4.product.id))[0]?.requestedQuantity, 1);
    console.log("S4: pass");

    const s5 = await fixture({ quantity: 3 });
    await resync(s5.product.id);
    const s5Suggested = (await suggestion(s5.product.id))[0]!;
    await updateOrderRequestStatusForContext(context, {
      orderRequestId: s5Suggested.id, status: "CONFIRMED", memo: null, revalidate: false,
    });
    await changeStock(s5.product.id, -1);
    const s5Rows = await prisma.orderRequest.findMany({ where: { productId: s5.product.id } });
    assert.equal(s5Rows.find((row) => row.status === "CONFIRMED")?.requestedQuantity, 2);
    assert.equal(s5Rows.find((row) => row.status === "SUGGESTED")?.requestedQuantity, 1);
    console.log("S5: pass");

    const s6 = await fixture({ quantity: 3 });
    await resync(s6.product.id);
    const s6Suggested = (await suggestion(s6.product.id))[0]!;
    await updateOrderRequestQuantityForContext(context, {
      orderRequestId: s6Suggested.id, requestedQuantity: 3, revalidate: false,
    });
    await changeStock(s6.product.id, -1);
    const s6Row = await prisma.orderRequest.findUniqueOrThrow({ where: { id: s6Suggested.id } });
    assert.equal(s6Row.status, "CONFIRMED");
    assert.equal(s6Row.requestedQuantity, 3);
    console.log("S6: pass");

    const s7 = await fixture({ quantity: 3 });
    await resync(s7.product.id);
    await changeStock(s7.product.id, 2);
    assert.equal((await suggestion(s7.product.id)).length, 0);
    assert.equal(await prisma.auditLog.count({ where: { action: "order_suggestion.removed", targetId: s7.product.id } }), 1);
    console.log("S7: pass");

    const s8 = await fixture({ quantity: 3 });
    await resync(s8.product.id);
    await updateOrderRequestStatusForContext(context, {
      orderRequestId: (await suggestion(s8.product.id))[0]!.id, status: "SKIPPED", memo: null, revalidate: false,
    });
    await changeStock(s8.product.id, -1);
    assert.equal((await suggestion(s8.product.id)).length, 0);
    await changeStock(s8.product.id, 3);
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: s8.stock.id } })).autoOrderSuppressedAt, null);
    await changeStock(s8.product.id, -1);
    assert.equal((await suggestion(s8.product.id)).length, 1);
    console.log("S8: pass");

    const s9 = await fixture({ quantity: 2 });
    const s9Order = await prisma.orderRequest.create({ data: {
      clinicId: clinic.id, productId: s9.product.id, status: "ORDERED", requestedQuantity: 3,
      orderedAt: new Date(), createdByUserId: user.id,
    } });
    await resync(s9.product.id);
    assert.equal((await suggestion(s9.product.id)).length, 0);
    await receiveOrderRequestForContext(context, {
      orderRequestId: s9Order.id, receivedQuantity: 2, receivedByStaffId: staff.id,
      receivedMemo: null, applyToStock: false, revalidate: false,
    });
    const afterReceive = (await suggestion(s9.product.id))[0]?.requestedQuantity ?? 0;
    await revertOrderReceiptForContext(context, { orderRequestId: s9Order.id, revalidate: false });
    const afterRevert = (await suggestion(s9.product.id))[0]?.requestedQuantity ?? 0;
    assert.notEqual(afterReceive, afterRevert);
    console.log("S9: pass");

    for (const input of [
      { min: 0 }, { quantity: 1, orderUnit: null }, { quantity: 1, stockUsageMode: "OPEN_PACK" as const },
      { quantity: 1, isActive: false },
    ]) {
      const row = await fixture(input);
      await prisma.orderRequest.create({ data: {
        clinicId: clinic.id, productId: row.product.id, status: "SUGGESTED", requestedQuantity: 4, createdByUserId: user.id,
      } });
      await resync(row.product.id);
      assert.equal((await suggestion(row.product.id)).length, 0);
    }
    console.log("S10: pass");

    const s11 = await fixture({ quantity: 1 });
    await resync(s11.product.id);
    const s11Suggested = (await suggestion(s11.product.id))[0]!;
    const printRows = getPrintableOrderRows(await getOrderRequestRows(clinic.id));
    assert.equal(printRows.some((row) => row.id === s11Suggested.id), false);
    assert.equal((await getActiveOrderRequestProductIds(clinic.id)).has(s11.product.id), false);
    await assert.rejects(markOrderRequestsOrderedForContext(context, {
      orderRequestIds: [s11Suggested.id], orderedMethod: "PHONE", orderedMemo: null,
      supplierResponseMemo: null, orderedByStaffId: staff.id, revalidate: false,
    }));
    console.log("S11: pass");

    const s12 = await fixture();
    await Promise.all([changeStock(s12.product.id, -1), changeStock(s12.product.id, -1)]);
    assert.deepEqual((await suggestion(s12.product.id)).map((row) => row.requestedQuantity), [2]);
    console.log("S12: pass");

    const s13 = await fixture({ quantity: 5 });
    await Promise.all([
      changeStock(s13.product.id, -1),
      prisma.$transaction(async (tx) => {
        await lockOrderRequestProduct(tx, clinic.id, s13.product.id);
        const existing = await tx.orderRequest.findFirst({
          where: { clinicId: clinic.id, productId: s13.product.id, status: "SUGGESTED" },
        });
        if (existing) await tx.orderRequest.update({ where: { id: existing.id }, data: { status: "CONFIRMED" } });
        else await tx.orderRequest.create({ data: {
          clinicId: clinic.id, productId: s13.product.id, status: "CONFIRMED", requestedQuantity: 1,
          createdByUserId: user.id,
        } });
        await syncOrderSuggestion(tx, {
          clinicId: clinic.id, organizationId: organization.id, productId: s13.product.id, actorUserId: user.id,
        });
      }),
    ]);
    const s13Active = await prisma.orderRequest.findMany({
      where: { productId: s13.product.id, status: { in: ["SUGGESTED", "DRAFT", "CONFIRMED"] } },
    });
    assert.equal(s13Active.length, 1);
    console.log("S13: pass");

    const s14 = await fixture({ quantity: 2 });
    const s14Order = await prisma.orderRequest.create({ data: {
      clinicId: clinic.id, productId: s14.product.id, status: "ORDERED", requestedQuantity: 2,
      orderedAt: new Date(), createdByUserId: user.id,
    } });
    const s14Result = await Promise.race([
      Promise.allSettled([
        receiveOrderRequestForContext(context, { orderRequestId: s14Order.id, receivedQuantity: 1,
          receivedByStaffId: staff.id, receivedMemo: null, applyToStock: true, revalidate: false }),
        updateOrderRequestStatusForContext(context, { orderRequestId: s14Order.id, status: "CONFIRMED", memo: null, revalidate: false }),
        changeStock(s14.product.id, -1),
      ]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("S14 timeout")), 5000)),
    ]);
    assert.equal(s14Result.length, 3);
    console.log("S14: pass");

    const s15 = await fixture();
    const started = performance.now();
    await changeStock(s15.product.id, -1);
    const s15Order = await prisma.orderRequest.create({ data: {
      clinicId: clinic.id, productId: s15.product.id, status: "ORDERED", requestedQuantity: 1,
      orderedAt: new Date(), createdByUserId: user.id,
    } });
    await receiveOrderRequestForContext(context, { orderRequestId: s15Order.id, receivedQuantity: 1,
      receivedByStaffId: staff.id, receivedMemo: null, applyToStock: true, revalidate: false });
    assert.ok(performance.now() - started < 5000);
    console.log("S15: pass");

    const s16 = await fixture();
    await assert.rejects(changeStock(s16.product.id, -1, 999), /conflict/);
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: s16.stock.id } })).quantity, 5);
    assert.equal((await suggestion(s16.product.id)).length, 0);
    console.log("S16: pass");

    // S17: a 100-item stocktake commit stays within the 5s window on one connection,
    // because suggestions are re-synced per product after the stock update commits.
    const { commitStocktakeSessionForContext } = await import("../src/lib/actions/stocktake-sessions");
    const s17Products = [];
    for (let index = 0; index < 100; index += 1) s17Products.push(await fixture({ quantity: 5 }));
    const s17Session = await prisma.stocktakeSession.create({ data: {
      clinicId: clinic.id, startedByUserId: user.id,
      items: { create: s17Products.map(({ product }) => ({
        productId: product.id, expectedQuantity: 5, countedQuantity: 2, diff: -3, status: "COUNTED",
      })) },
    } });
    const s17Started = performance.now();
    await commitStocktakeSessionForContext({ context, sessionId: s17Session.id, revalidate: false });
    const s17Ms = Math.round(performance.now() - s17Started);
    assert.equal((await prisma.stocktakeSession.findUniqueOrThrow({ where: { id: s17Session.id } })).status, "COMMITTED");
    const s17Suggestions = await prisma.orderRequest.findMany({
      where: { clinicId: clinic.id, productId: { in: s17Products.map(({ product }) => product.id) }, status: "SUGGESTED" },
    });
    assert.equal(s17Suggestions.length, 100);
    assert.ok(s17Suggestions.every((row) => row.requestedQuantity === 3));
    console.log(`S17: 100-item stocktake commit passed in ${s17Ms}ms`);

    // S18: a 100-product bulk min-stock setup also re-syncs outside its main transaction.
    const { updatePurchaseHistorySetupForContext } = await import("../src/lib/actions/purchase-history-setup");
    const s18Products = [];
    for (let index = 0; index < 100; index += 1) {
      serial += 1;
      const product = await prisma.product.create({ data: {
        organizationId: organization.id, name: `架空購入履歴商品${serial}`, productCode: `FICT-PH-${serial}`,
        defaultMinStock: 0, orderUnit: "箱", importSource: "PURCHASE_HISTORY",
      } });
      await prisma.stockItem.create({ data: { clinicId: clinic.id, productId: product.id, quantity: 1 } });
      s18Products.push(product);
    }
    const s18Started = performance.now();
    await updatePurchaseHistorySetupForContext({ userId: user.id, organizationId: organization.id },
      s18Products.map((product) => ({ productId: product.id, category: "架空分類", defaultMinStock: 3 })));
    const s18Ms = Math.round(performance.now() - s18Started);
    const s18Suggestions = await prisma.orderRequest.findMany({
      where: { clinicId: clinic.id, productId: { in: s18Products.map(({ id }) => id) }, status: "SUGGESTED" },
    });
    assert.equal(s18Suggestions.length, 100);
    assert.ok(s18Suggestions.every((row) => row.requestedQuantity === 2));
    console.log(`S18: 100-product bulk setup passed in ${s18Ms}ms`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
