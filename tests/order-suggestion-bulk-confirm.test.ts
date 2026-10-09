import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();
  const { prisma } = await import("../src/lib/db/prisma");
  const { confirmOrderSuggestionsForContext, updateOrderRequestStatusForContext } =
    await import("../src/lib/actions/orders");
  const { lockOrderRequestProduct } = await import("../src/lib/orders/locks");
  const { syncOrderSuggestion } = await import("../src/lib/orders/suggestions");

  try {
    const organization = await prisma.organization.create({ data: { name: "架空の発注テスト組織" } });
    const clinic = await prisma.clinic.create({ data: { organizationId: organization.id, name: "架空拠点A" } });
    const otherClinic = await prisma.clinic.create({ data: { organizationId: organization.id, name: "架空拠点B" } });
    const user = await prisma.user.create({ data: {
      organizationId: organization.id, name: "架空担当者", email: "bulk-confirm@example.test", passwordHash: "test",
    } });
    const supplier = await prisma.supplier.create({ data: { organizationId: organization.id, name: "架空発注先" } });
    const context = {
      userId: user.id, userName: user.name, organizationId: organization.id,
      clinicId: clinic.id, clinicName: clinic.name,
    };

    let serial = 0;
    async function makeSuggestion(clinicId = clinic.id) {
      serial += 1;
      const product = await prisma.product.create({ data: {
        organizationId: organization.id, name: `架空商品${serial}`, productCode: `BULK-${serial}`,
        defaultMinStock: 5, orderUnit: "個", primarySupplierId: supplier.id,
      } });
      const stock = await prisma.stockItem.create({ data: {
        clinicId, productId: product.id, quantity: 3, minStock: 5,
      } });
      await prisma.$transaction(async (tx) => {
        await lockOrderRequestProduct(tx, clinicId, product.id);
        await syncOrderSuggestion(tx, {
          clinicId, organizationId: organization.id, productId: product.id, actorUserId: user.id,
        });
      });
      const request = await prisma.orderRequest.findFirstOrThrow({ where: {
        clinicId, productId: product.id, status: "SUGGESTED",
      } });
      return { product, stock, request };
    }
    async function makeSuggestions(count: number) {
      const suggestions: Awaited<ReturnType<typeof makeSuggestion>>[] = [];
      for (let offset = 0; offset < count; offset += 5) {
        suggestions.push(...await Promise.all(
          Array.from({ length: Math.min(5, count - offset) }, () => makeSuggestion()),
        ));
      }
      return suggestions;
    }

    const first = await Promise.all([makeSuggestion(), makeSuggestion(), makeSuggestion()]);
    const result1 = await confirmOrderSuggestionsForContext(context, {
      orderRequestIds: first.map(({ request }) => request.id), revalidate: false,
    });
    assert.deepEqual(result1, { confirmedCount: 3, excludedCount: 0 });
    assert.equal(await prisma.orderRequest.count({ where: {
      id: { in: first.map(({ request }) => request.id) }, status: "CONFIRMED",
    } }), 3);
    assert.equal(await prisma.stockItem.count({ where: {
      id: { in: first.map(({ stock }) => stock.id) }, autoOrderSuppressedAt: null,
    } }), 3);
    assert.equal(await prisma.orderRequest.count({ where: {
      productId: { in: first.map(({ product }) => product.id) }, status: "SUGGESTED",
    } }), 0);
    console.log("T1: pass");

    const second = await Promise.all([makeSuggestion(), makeSuggestion(), makeSuggestion()]);
    await updateOrderRequestStatusForContext(context, {
      orderRequestId: second[0]!.request.id, status: "SKIPPED", memo: null, revalidate: false,
    });
    const result2 = await confirmOrderSuggestionsForContext(context, {
      orderRequestIds: second.map(({ request }) => request.id), revalidate: false,
    });
    assert.deepEqual(result2, { confirmedCount: 2, excludedCount: 1 });
    assert.equal(await prisma.orderRequest.count({ where: {
      id: { in: second.map(({ request }) => request.id) }, status: "CONFIRMED",
    } }), 2);
    assert.equal((await prisma.orderRequest.findUniqueOrThrow({ where: { id: second[0]!.request.id } })).status, "SKIPPED");
    console.log("T2: pass");

    await assert.rejects(
      () => confirmOrderSuggestionsForContext(context, {
        orderRequestIds: second.map(({ request }) => request.id), revalidate: false,
      }),
      /確認待ちの候補が見つかりません。一覧を更新してください。/,
    );
    console.log("T3: pass");

    const local = await makeSuggestion();
    const foreign = await makeSuggestion(otherClinic.id);
    const result4 = await confirmOrderSuggestionsForContext(context, {
      orderRequestIds: [local.request.id, foreign.request.id], revalidate: false,
    });
    assert.deepEqual(result4, { confirmedCount: 1, excludedCount: 1 });
    assert.equal((await prisma.orderRequest.findUniqueOrThrow({ where: { id: foreign.request.id } })).status, "SUGGESTED");
    console.log("T4: pass");

    const memoProduct = await prisma.product.create({ data: {
      organizationId: organization.id, name: "架空メモ商品", productCode: "BULK-MEMO", defaultMinStock: 0,
    } });
    const memoRequest = await prisma.orderRequest.create({ data: {
      clinicId: clinic.id, productId: memoProduct.id, status: "ORDERED", requestedQuantity: 2,
      memo: "備考A", orderedMethod: "FAX", orderedAt: new Date(), createdByUserId: user.id,
    } });
    await updateOrderRequestStatusForContext(context, {
      orderRequestId: memoRequest.id, status: "CONFIRMED", revalidate: false,
    });
    assert.equal((await prisma.orderRequest.findUniqueOrThrow({ where: { id: memoRequest.id } })).memo, "備考A");
    console.log("T5: pass");

    await updateOrderRequestStatusForContext(context, {
      orderRequestId: memoRequest.id, status: "SKIPPED", memo: null, revalidate: false,
    });
    assert.equal((await prisma.orderRequest.findUniqueOrThrow({ where: { id: memoRequest.id } })).memo, null);
    console.log("T6: pass");

    const seventh = await makeSuggestions(45);
    const result7 = await confirmOrderSuggestionsForContext(context, {
      orderRequestIds: seventh.map(({ request }) => request.id), revalidate: false,
    });
    assert.deepEqual(result7, { confirmedCount: 45, excludedCount: 0 });
    assert.equal(await prisma.orderRequest.count({ where: {
      id: { in: seventh.map(({ request }) => request.id) }, status: "CONFIRMED",
    } }), 45);
    assert.equal(await prisma.stockItem.count({ where: {
      id: { in: seventh.map(({ stock }) => stock.id) }, autoOrderSuppressedAt: null,
    } }), 45);
    assert.equal(await prisma.orderRequest.count({ where: {
      productId: { in: seventh.map(({ product }) => product.id) }, status: "SUGGESTED",
    } }), 0);
    console.log("T7: pass");

    const eighth = await makeSuggestions(45);
    const skipped = [...eighth].sort((a, b) => a.product.id.localeCompare(b.product.id))[24]!;
    await updateOrderRequestStatusForContext(context, {
      orderRequestId: skipped.request.id, status: "SKIPPED", memo: null, revalidate: false,
    });
    const result8 = await confirmOrderSuggestionsForContext(context, {
      orderRequestIds: eighth.map(({ request }) => request.id), revalidate: false,
    });
    assert.deepEqual(result8, { confirmedCount: 44, excludedCount: 1 });
    assert.equal(await prisma.orderRequest.count({ where: {
      id: { in: eighth.map(({ request }) => request.id) }, status: "CONFIRMED",
    } }), 44);
    assert.equal((await prisma.orderRequest.findUniqueOrThrow({ where: { id: skipped.request.id } })).status, "SKIPPED");
    assert.equal(await prisma.orderRequest.count({ where: {
      productId: { in: eighth.map(({ product }) => product.id) }, status: "SUGGESTED",
    } }), 0);
    console.log("T8: pass");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
