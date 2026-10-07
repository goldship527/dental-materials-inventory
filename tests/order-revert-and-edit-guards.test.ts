import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

type TestContext = {
  userId: string;
  userName: string;
  organizationId: string;
  clinicId: string;
  clinicName: string;
};

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const {
    receiveOrderRequestForContext,
    revertOrderReceiptForContext,
    updateOrderRequestQuantityForContext,
    updateOrderRequestStatusForContext,
  } = await import("../src/lib/actions/orders");
  const { toOrderActionError } = await import("../src/lib/orders/action-error");
  const { canChangeOrderRequestQuantity } = await import("../src/lib/orders/status");

  try {
    const organization = await prisma.organization.create({
      data: {
        name: "Order Guard Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Order Guard Test Clinic",
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Order Guard Test User",
        email: "order-guard-user@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const staffOperator = await prisma.staffOperator.create({
      data: {
        organizationId: organization.id,
        displayName: "Order Guard Test Staff",
        barcode: "ORDER-GUARD-STAFF",
        clinicAssignments: {
          create: {
            clinicId: clinic.id,
          },
        },
      },
    });
    const context: TestContext = {
      userId: user.id,
      userName: user.name,
      organizationId: organization.id,
      clinicId: clinic.id,
      clinicName: clinic.name,
    };
    let productSequence = 0;

    async function createProductWithStock(stockQuantity = 10) {
      productSequence += 1;
      const product = await prisma.product.create({
        data: {
          organizationId: organization.id,
          name: `Order Guard Product ${productSequence}`,
          productCode: `ORDER-GUARD-${productSequence}`,
          defaultMinStock: 3,
        },
      });
      const stockItem = await prisma.stockItem.create({
        data: {
          clinicId: clinic.id,
          productId: product.id,
          quantity: stockQuantity,
          minStock: 3,
        },
      });

      return { product, stockItem };
    }

    async function createOrder(
      productId: string,
      input: {
        requestedQuantity?: number;
        status?: "DRAFT" | "CONFIRMED" | "SKIPPED" | "ORDERED";
        receivedAt?: Date | null;
        receivedQuantity?: number | null;
      } = {},
    ) {
      return prisma.orderRequest.create({
        data: {
          clinicId: clinic.id,
          productId,
          requestedQuantity: input.requestedQuantity ?? 3,
          status: input.status ?? "ORDERED",
          orderedAt: (input.status ?? "ORDERED") === "ORDERED" ? new Date("2026-10-01T00:00:00.000Z") : null,
          receivedAt: input.receivedAt,
          receivedQuantity: input.receivedQuantity,
          createdByUserId: user.id,
        },
      });
    }

    async function receive(orderRequestId: string, receivedQuantity: number, applyToStock = true) {
      return receiveOrderRequestForContext(context, {
        orderRequestId,
        receivedQuantity,
        receivedByStaffId: staffOperator.id,
        receivedMemo: null,
        applyToStock,
        revalidate: false,
      });
    }

    // R1 / R2: partial receipt links the backorder, then parent revert removes it atomically.
    const r1 = await createProductWithStock(10);
    const r1Parent = await createOrder(r1.product.id);
    await receive(r1Parent.id, 2);
    const r1Backorder = await prisma.orderRequest.findFirstOrThrow({
      where: {
        backorderOfId: r1Parent.id,
      },
    });
    assert.equal(r1Backorder.requestedQuantity, 1);
    assert.equal(r1Backorder.status, "ORDERED");
    assert.equal(r1Backorder.receivedAt, null);

    await revertOrderReceiptForContext(context, {
      orderRequestId: r1Parent.id,
      revalidate: false,
    });
    assert.equal(await prisma.orderRequest.count({ where: { id: r1Backorder.id } }), 0);
    const r2Parent = await prisma.orderRequest.findUniqueOrThrow({ where: { id: r1Parent.id } });
    assert.equal(r2Parent.requestedQuantity, 3);
    assert.equal(r2Parent.receivedAt, null);
    assert.equal(
      await prisma.orderRequest.aggregate({
        where: {
          clinicId: clinic.id,
          productId: r1.product.id,
          status: "ORDERED",
          receivedAt: null,
        },
        _sum: { requestedQuantity: true },
      }).then((result) => result._sum.requestedQuantity),
      3,
    );
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: r1.stockItem.id } })).quantity, 10);

    // R3 / R4: a received backorder blocks parent revert until the child receipt is reverted.
    const r3 = await createProductWithStock(10);
    const r3Parent = await createOrder(r3.product.id);
    await receive(r3Parent.id, 2);
    const r3Backorder = await prisma.orderRequest.findFirstOrThrow({ where: { backorderOfId: r3Parent.id } });
    await receive(r3Backorder.id, 1);
    const r3Before = {
      stock: (await prisma.stockItem.findUniqueOrThrow({ where: { id: r3.stockItem.id } })).quantity,
      orders: await prisma.orderRequest.count({ where: { productId: r3.product.id } }),
      movements: await prisma.stockMovement.count({ where: { productId: r3.product.id } }),
    };
    await assert.rejects(
      revertOrderReceiptForContext(context, { orderRequestId: r3Parent.id, revalidate: false }),
      /不足分の納品が確認済み/,
    );
    assert.deepEqual(
      {
        stock: (await prisma.stockItem.findUniqueOrThrow({ where: { id: r3.stockItem.id } })).quantity,
        orders: await prisma.orderRequest.count({ where: { productId: r3.product.id } }),
        movements: await prisma.stockMovement.count({ where: { productId: r3.product.id } }),
      },
      r3Before,
    );
    await revertOrderReceiptForContext(context, { orderRequestId: r3Backorder.id, revalidate: false });
    await revertOrderReceiptForContext(context, { orderRequestId: r3Parent.id, revalidate: false });
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: r3.stockItem.id } })).quantity, 10);
    assert.deepEqual(
      await prisma.orderRequest.findMany({
        where: { productId: r3.product.id },
        select: { id: true, requestedQuantity: true, receivedAt: true },
      }),
      [{ id: r3Parent.id, requestedQuantity: 3, receivedAt: null }],
    );

    // R5: a skipped, unreceived backorder is still deleted with the parent revert.
    const r5 = await createProductWithStock(5);
    const r5Parent = await createOrder(r5.product.id);
    await receive(r5Parent.id, 2);
    const r5Backorder = await prisma.orderRequest.findFirstOrThrow({ where: { backorderOfId: r5Parent.id } });
    await updateOrderRequestStatusForContext(context, {
      orderRequestId: r5Backorder.id,
      status: "SKIPPED",
      memo: "Delivery cancelled",
      revalidate: false,
    });
    await revertOrderReceiptForContext(context, { orderRequestId: r5Parent.id, revalidate: false });
    assert.equal(await prisma.orderRequest.count({ where: { id: r5Backorder.id } }), 0);
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: r5.stockItem.id } })).quantity, 5);

    // R6: legacy partial receipt rows without a linked backorder fail closed.
    const r6 = await createProductWithStock(5);
    const r6Parent = await createOrder(r6.product.id);
    await receiveOrderRequestForContext(context, {
      orderRequestId: r6Parent.id,
      receivedQuantity: 2,
      receivedByStaffId: staffOperator.id,
      receivedMemo: null,
      applyToStock: true,
      createShortfallBackorder: false,
      revalidate: false,
    });
    await assert.rejects(
      revertOrderReceiptForContext(context, { orderRequestId: r6Parent.id, revalidate: false }),
      /不足分の発注を特定できない/,
    );
    assert.equal((await prisma.stockItem.findUniqueOrThrow({ where: { id: r6.stockItem.id } })).quantity, 7);

    // R7: quantity is editable only for draft/confirmed and unreceived ordered rows.
    const r7 = await createProductWithStock();
    const r7Draft = await createOrder(r7.product.id, { status: "DRAFT", requestedQuantity: 1 });
    const r7Confirmed = await createOrder(r7.product.id, { status: "CONFIRMED", requestedQuantity: 1 });
    const r7Ordered = await createOrder(r7.product.id, { status: "ORDERED", requestedQuantity: 1 });
    const r7Received = await createOrder(r7.product.id, {
      status: "ORDERED",
      requestedQuantity: 1,
      receivedAt: new Date("2026-10-02T00:00:00.000Z"),
      receivedQuantity: 1,
    });
    const r7Skipped = await createOrder(r7.product.id, { status: "SKIPPED", requestedQuantity: 1 });
    for (const request of [r7Draft, r7Confirmed, r7Ordered]) {
      await updateOrderRequestQuantityForContext(context, {
        orderRequestId: request.id,
        requestedQuantity: 2,
        revalidate: false,
      });
    }
    for (const request of [r7Received, r7Skipped]) {
      await assert.rejects(
        updateOrderRequestQuantityForContext(context, {
          orderRequestId: request.id,
          requestedQuantity: 2,
          revalidate: false,
        }),
        /状態が変わりました/,
      );
      assert.equal((await prisma.orderRequest.findUniqueOrThrow({ where: { id: request.id } })).requestedQuantity, 1);
    }
    assert.equal(canChangeOrderRequestQuantity("DRAFT", null), true);
    assert.equal(canChangeOrderRequestQuantity("CONFIRMED", null), true);
    assert.equal(canChangeOrderRequestQuantity("ORDERED", null), true);
    assert.equal(canChangeOrderRequestQuantity("ORDERED", new Date()), false);
    assert.equal(canChangeOrderRequestQuantity("SKIPPED", null), false);

    // R8: received rows cannot be changed to skipped.
    await assert.rejects(
      updateOrderRequestStatusForContext(context, {
        orderRequestId: r7Received.id,
        status: "SKIPPED",
        memo: null,
        revalidate: false,
      }),
      /納品確認済み/,
    );

    // R9: reverting ordered/skipped rows to a draft state rejects duplicate drafts.
    const r9 = await createProductWithStock();
    const r9Ordered = await createOrder(r9.product.id, { status: "ORDERED" });
    await createOrder(r9.product.id, { status: "CONFIRMED" });
    await assert.rejects(
      updateOrderRequestStatusForContext(context, {
        orderRequestId: r9Ordered.id,
        status: "CONFIRMED",
        memo: null,
        revalidate: false,
      }),
      /同じ商品の発注予定がすでにあります/,
    );

    // R10: receipt and skip serialize on the same row; both states cannot be committed together.
    const r10 = await createProductWithStock();
    const r10Order = await createOrder(r10.product.id, { status: "ORDERED" });
    const r10Results = await Promise.allSettled([
      receive(r10Order.id, 3, false),
      updateOrderRequestStatusForContext(context, {
        orderRequestId: r10Order.id,
        status: "SKIPPED",
        memo: "Delivery cancelled",
        revalidate: false,
      }),
    ]);
    assert.equal(r10Results.filter((result) => result.status === "fulfilled").length, 1);
    const r10Final = await prisma.orderRequest.findUniqueOrThrow({ where: { id: r10Order.id } });
    assert.equal(r10Final.status === "SKIPPED" && r10Final.receivedAt !== null, false);

    // R11: a quantity update that reaches the lock after receipt is rejected.
    const r11 = await createProductWithStock();
    const r11Order = await createOrder(r11.product.id, { status: "ORDERED", requestedQuantity: 3 });
    const r11Receipt = receive(r11Order.id, 3, false);
    await new Promise((resolve) => setTimeout(resolve, 25));
    const r11Results = await Promise.allSettled([
      r11Receipt,
      updateOrderRequestQuantityForContext(context, {
        orderRequestId: r11Order.id,
        requestedQuantity: 4,
        revalidate: false,
      }),
    ]);
    assert.equal(r11Results[0]?.status, "fulfilled");
    assert.equal(r11Results[1]?.status, "rejected");
    assert.equal((await prisma.orderRequest.findUniqueOrThrow({ where: { id: r11Order.id } })).requestedQuantity, 3);

    // R13: unexpected internal errors never expose their original message to the action UI.
    const r13 = toOrderActionError(new Error("fictional Prisma P2002 internal details"));
    assert.deepEqual(r13, {
      status: "error",
      message: "結果を確認できませんでした。入出庫履歴と最新の一覧を確認してから操作してください。",
    });
    assert.equal(r13.message?.includes("P2002"), false);

    console.log("R1-R11 and R13 passed");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
