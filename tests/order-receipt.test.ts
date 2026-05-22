import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { receiveOrderRequestForContext, revertOrderReceiptForContext } = await import("../src/lib/actions/orders");
  const { revertStockMovementForContext } = await import("../src/lib/actions/stock-movements");

  try {
    const organization = await prisma.organization.create({
      data: {
        name: "Order Receipt Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Order Receipt Test Clinic",
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Order Receipt User",
        email: "order-receipt-user@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const product = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Order Receipt Product",
        productCode: "ORDER-RECEIPT-001",
        defaultMinStock: 3,
      },
    });

    await prisma.userClinicAssignment.create({
      data: {
        userId: user.id,
        clinicId: clinic.id,
      },
    });
    await prisma.stockItem.create({
      data: {
        clinicId: clinic.id,
        productId: product.id,
        quantity: 2,
        minStock: 3,
      },
    });

    const request = await prisma.orderRequest.create({
      data: {
        clinicId: clinic.id,
        productId: product.id,
        requestedQuantity: 3,
        status: "ORDERED",
        orderedAt: new Date("2026-05-22T00:00:00.000Z"),
        createdByUserId: user.id,
      },
    });
    const context = {
      userId: user.id,
      userName: user.name,
      organizationId: organization.id,
      clinicId: clinic.id,
      clinicName: clinic.name,
    };

    const result = await receiveOrderRequestForContext(context, {
      orderRequestId: request.id,
      receivedQuantity: 2,
      receivedMemo: "Arrived in two boxes",
      applyToStock: true,
      revalidate: false,
    });

    assert.equal(result.productName, "Order Receipt Product");
    assert.equal(result.afterQuantity, 4);

    const receivedRequest = await prisma.orderRequest.findUniqueOrThrow({
      where: {
        id: request.id,
      },
    });

    assert.equal(receivedRequest.receivedQuantity, 2);
    assert.notEqual(receivedRequest.receivedAt, null);
    assert.equal(receivedRequest.receivedMemo, "Arrived in two boxes");
    assert.equal(receivedRequest.receivedByUserId, user.id);

    const stockItem = await prisma.stockItem.findFirstOrThrow({
      where: {
        clinicId: clinic.id,
        productId: product.id,
      },
    });

    assert.equal(stockItem.quantity, 4);

    const movement = await prisma.stockMovement.findFirstOrThrow({
      where: {
        clinicId: clinic.id,
        productId: product.id,
        sourceType: "ORDER_RECEIPT",
      },
    });

    assert.equal(movement.movementType, "IN");
    assert.equal(movement.quantity, 2);
    assert.equal(movement.beforeQuantity, 2);
    assert.equal(movement.afterQuantity, 4);
    assert.equal(movement.reason, "納品");
    assert.equal(movement.sourceId, request.id);

    await assert.rejects(() =>
      revertStockMovementForContext({
        context,
        movementId: movement.id,
        revalidate: false,
      }),
    );

    await assert.rejects(() =>
      receiveOrderRequestForContext(context, {
        orderRequestId: request.id,
        receivedQuantity: 1,
        receivedMemo: null,
        applyToStock: true,
        revalidate: false,
      }),
    );

    const revertResult = await revertOrderReceiptForContext(context, {
      orderRequestId: request.id,
      revalidate: false,
    });

    assert.equal(revertResult.productName, "Order Receipt Product");
    assert.equal(revertResult.afterQuantity, 2);

    const revertedRequest = await prisma.orderRequest.findUniqueOrThrow({
      where: {
        id: request.id,
      },
    });

    assert.equal(revertedRequest.receivedQuantity, null);
    assert.equal(revertedRequest.receivedAt, null);
    assert.equal(revertedRequest.receivedMemo, null);
    assert.equal(revertedRequest.receivedByUserId, null);

    const stockItemAfterRevert = await prisma.stockItem.findFirstOrThrow({
      where: {
        clinicId: clinic.id,
        productId: product.id,
      },
    });

    assert.equal(stockItemAfterRevert.quantity, 2);

    const revertedReceiptMovement = await prisma.stockMovement.findUniqueOrThrow({
      where: {
        id: movement.id,
      },
    });

    assert.notEqual(revertedReceiptMovement.revertedAt, null);
    assert.equal(revertedReceiptMovement.revertedById, user.id);

    const revertMovement = await prisma.stockMovement.findFirstOrThrow({
      where: {
        clinicId: clinic.id,
        productId: product.id,
        sourceType: "ORDER_RECEIPT_REVERT",
        revertOfId: movement.id,
      },
    });

    assert.equal(revertMovement.movementType, "OUT");
    assert.equal(revertMovement.quantity, -2);
    assert.equal(revertMovement.beforeQuantity, 4);
    assert.equal(revertMovement.afterQuantity, 2);
    assert.equal(revertMovement.reason, "納品確認取り消し");
    assert.equal(revertMovement.sourceId, request.id);

    await assert.rejects(() =>
      revertOrderReceiptForContext(context, {
        orderRequestId: request.id,
        revalidate: false,
      }),
    );

    const draftRequest = await prisma.orderRequest.create({
      data: {
        clinicId: clinic.id,
        productId: product.id,
        requestedQuantity: 1,
        status: "DRAFT",
        createdByUserId: user.id,
      },
    });

    await assert.rejects(() =>
      receiveOrderRequestForContext(context, {
        orderRequestId: draftRequest.id,
        receivedQuantity: 1,
        receivedMemo: null,
        applyToStock: false,
        revalidate: false,
      }),
    );

    const orderedRequest = await prisma.orderRequest.create({
      data: {
        clinicId: clinic.id,
        productId: product.id,
        requestedQuantity: 1,
        status: "ORDERED",
        createdByUserId: user.id,
      },
    });

    await assert.rejects(() =>
      receiveOrderRequestForContext(context, {
        orderRequestId: orderedRequest.id,
        receivedQuantity: 2,
        receivedMemo: null,
        applyToStock: false,
        revalidate: false,
      }),
    );

    await receiveOrderRequestForContext(context, {
      orderRequestId: orderedRequest.id,
      receivedQuantity: 1,
      receivedMemo: "Record only",
      applyToStock: false,
      revalidate: false,
    });

    const recordOnlyRevertResult = await revertOrderReceiptForContext(context, {
      orderRequestId: orderedRequest.id,
      revalidate: false,
    });

    assert.equal(recordOnlyRevertResult.afterQuantity, null);

    const stockItemAfterRecordOnlyRevert = await prisma.stockItem.findFirstOrThrow({
      where: {
        clinicId: clinic.id,
        productId: product.id,
      },
    });

    assert.equal(stockItemAfterRecordOnlyRevert.quantity, 2);

    const stockReflectedRequest = await prisma.orderRequest.create({
      data: {
        clinicId: clinic.id,
        productId: product.id,
        requestedQuantity: 2,
        status: "ORDERED",
        createdByUserId: user.id,
      },
    });

    await receiveOrderRequestForContext(context, {
      orderRequestId: stockReflectedRequest.id,
      receivedQuantity: 2,
      receivedMemo: null,
      applyToStock: true,
      revalidate: false,
    });

    await prisma.stockItem.update({
      where: {
        id: stockItemAfterRecordOnlyRevert.id,
      },
      data: {
        quantity: 1,
      },
    });

    await assert.rejects(() =>
      revertOrderReceiptForContext(context, {
        orderRequestId: stockReflectedRequest.id,
        revalidate: false,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
