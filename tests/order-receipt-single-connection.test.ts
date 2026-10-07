import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { resetTestDatabase } from "./helpers/db";

async function createOrderedProduct(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    clinicId: string;
    userId: string;
    name: string;
    janCode: string;
    stockQuantity: number;
    requestedQuantity: number;
  },
) {
  const product = await prisma.product.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      productCode: input.name.toUpperCase().replace(/\s+/g, "-"),
      janCode: input.janCode,
      defaultMinStock: 1,
    },
  });
  await prisma.stockItem.create({
    data: {
      clinicId: input.clinicId,
      productId: product.id,
      quantity: input.stockQuantity,
      minStock: 1,
    },
  });
  const request = await prisma.orderRequest.create({
    data: {
      clinicId: input.clinicId,
      productId: product.id,
      requestedQuantity: input.requestedQuantity,
      status: "ORDERED",
      orderedAt: new Date("2026-06-01T00:00:00.000Z"),
      createdByUserId: input.userId,
    },
  });
  return { product, request };
}

async function main() {
  resetTestDatabase();
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set("connection_limit", "1");
  process.env.DATABASE_URL = url.toString();

  const { prisma } = await import("../src/lib/db/prisma");
  const { receiveOrderRequestForContext } = await import("../src/lib/actions/orders");
  const { batchOrderReceiveForContext } = await import("../src/lib/actions/barcode-batch");

  try {
    // A shared client query must fail while the only connection is held by a transaction.
    await assert.rejects(() =>
      prisma.$transaction(
        async () => {
          await prisma.staffOperator.findFirst();
        },
        { timeout: 1500, maxWait: 1500 },
      ),
    );
    console.log("T0: one-connection control rejected the shared-client query");

    const organization = await prisma.organization.create({
      data: { name: "Single Connection Organization" },
    });
    const clinic = await prisma.clinic.create({
      data: { organizationId: organization.id, name: "Single Connection Clinic" },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Single Connection User",
        email: "single-connection@example.test",
        passwordHash: "test-password-hash",
      },
    });
    await prisma.userClinicAssignment.create({ data: { userId: user.id, clinicId: clinic.id } });
    const staff = await prisma.staffOperator.create({
      data: {
        organizationId: organization.id,
        displayName: "Single Connection Staff",
        barcode: "STAFF-SINGLE-CONNECTION",
        clinicAssignments: { create: { clinicId: clinic.id } },
      },
    });
    const inactiveStaff = await prisma.staffOperator.create({
      data: {
        organizationId: organization.id,
        displayName: "Single Connection Inactive Staff",
        barcode: "STAFF-SINGLE-CONNECTION-INACTIVE",
        isActive: false,
        clinicAssignments: { create: { clinicId: clinic.id } },
      },
    });
    const context = {
      userId: user.id,
      userName: user.name,
      organizationId: organization.id,
      clinicId: clinic.id,
      clinicName: clinic.name,
    };

    const first = await createOrderedProduct(prisma, {
      organizationId: organization.id,
      clinicId: clinic.id,
      userId: user.id,
      name: "Single Connection Product A",
      janCode: "4900000000016",
      stockQuantity: 2,
      requestedQuantity: 3,
    });
    const startedSingle = performance.now();
    const singleResult = await receiveOrderRequestForContext(context, {
      orderRequestId: first.request.id,
      receivedQuantity: 2,
      receivedByStaffId: staff.id,
      receivedMemo: null,
      applyToStock: true,
      revalidate: false,
    });
    const singleMs = Math.round(performance.now() - startedSingle);
    assert.ok(singleMs < 5000, `T1 took ${singleMs}ms`);
    assert.equal(singleResult.afterQuantity, 4);
    const receivedFirst = await prisma.orderRequest.findUniqueOrThrow({ where: { id: first.request.id } });
    assert.equal(receivedFirst.receivedQuantity, 2);
    assert.notEqual(receivedFirst.receivedAt, null);
    assert.equal(receivedFirst.receivedByStaffId, staff.id);
    const firstBackorders = await prisma.orderRequest.findMany({
      where: {
        clinicId: clinic.id,
        productId: first.product.id,
        status: "ORDERED",
        receivedAt: null,
        memo: { contains: first.request.id },
      },
    });
    assert.equal(firstBackorders.length, 1);
    assert.equal(firstBackorders[0].requestedQuantity, 1);
    assert.equal(firstBackorders[0].supplierId, first.request.supplierId);
    assert.equal(
      (await prisma.stockItem.findUniqueOrThrow({
        where: { clinicId_productId: { clinicId: clinic.id, productId: first.product.id } },
      })).quantity,
      4,
    );
    const firstMovements = await prisma.stockMovement.findMany({
      where: {
        clinicId: clinic.id,
        productId: first.product.id,
        sourceType: "ORDER_RECEIPT",
        sourceId: first.request.id,
      },
    });
    assert.equal(firstMovements.length, 1);
    assert.equal(firstMovements[0].quantity, 2);
    assert.equal(firstMovements[0].performedByStaffId, staff.id);
    console.log(`T1: partial receipt passed in ${singleMs}ms`);

    await assert.rejects(
      () => receiveOrderRequestForContext(context, {
        orderRequestId: first.request.id,
        receivedQuantity: 1,
        receivedByStaffId: staff.id,
        receivedMemo: null,
        applyToStock: true,
        revalidate: false,
      }),
      /すでに納品確認済み/,
    );
    assert.equal(
      (await prisma.stockItem.findUniqueOrThrow({
        where: { clinicId_productId: { clinicId: clinic.id, productId: first.product.id } },
      })).quantity,
      4,
    );
    assert.equal(await prisma.stockMovement.count({ where: { sourceType: "ORDER_RECEIPT", sourceId: first.request.id } }), 1);
    assert.equal(await prisma.orderRequest.count({ where: { memo: { contains: first.request.id }, receivedAt: null } }), 1);
    console.log("T2: duplicate confirmation rejected without changes");

    const invalid = await createOrderedProduct(prisma, {
      organizationId: organization.id,
      clinicId: clinic.id,
      userId: user.id,
      name: "Single Connection Product B",
      janCode: "4900000000023",
      stockQuantity: 1,
      requestedQuantity: 2,
    });
    await assert.rejects(
      () => receiveOrderRequestForContext(context, {
        orderRequestId: invalid.request.id,
        receivedQuantity: 1,
        receivedByStaffId: inactiveStaff.id,
        receivedMemo: null,
        applyToStock: true,
        revalidate: false,
      }),
      /このクリニックで有効な作業スタッフ/,
    );
    assert.equal((await prisma.orderRequest.findUniqueOrThrow({ where: { id: invalid.request.id } })).receivedAt, null);
    assert.equal(await prisma.orderRequest.count({ where: { memo: { contains: invalid.request.id } } }), 0);
    assert.equal(await prisma.stockMovement.count({ where: { sourceType: "ORDER_RECEIPT", sourceId: invalid.request.id } }), 0);
    assert.equal(
      (await prisma.stockItem.findUniqueOrThrow({
        where: { clinicId_productId: { clinicId: clinic.id, productId: invalid.product.id } },
      })).quantity,
      1,
    );
    console.log("T3: inactive staff rejected without changes");

    const batchFirst = await createOrderedProduct(prisma, {
      organizationId: organization.id,
      clinicId: clinic.id,
      userId: user.id,
      name: "Single Connection Product C",
      janCode: "4900000000030",
      stockQuantity: 2,
      requestedQuantity: 3,
    });
    const batchSecond = await createOrderedProduct(prisma, {
      organizationId: organization.id,
      clinicId: clinic.id,
      userId: user.id,
      name: "Single Connection Product D",
      janCode: "4900000000047",
      stockQuantity: 1,
      requestedQuantity: 2,
    });
    const startedBatch = performance.now();
    const batchResult = await batchOrderReceiveForContext(context, {
      staffOperatorId: staff.id,
      lines: [
        {
          orderRequestId: batchFirst.request.id,
          barcode: batchFirst.product.janCode!,
          receivedQuantity: 2,
          receivedMemo: null,
          receivedLotNumber: null,
          receivedExpiryDateText: null,
        },
        {
          orderRequestId: batchSecond.request.id,
          barcode: batchSecond.product.janCode!,
          receivedQuantity: 2,
          receivedMemo: null,
          receivedLotNumber: null,
          receivedExpiryDateText: null,
        },
      ],
      revalidate: false,
    });
    const batchMs = Math.round(performance.now() - startedBatch);
    assert.ok(batchMs < 5000, `T4 took ${batchMs}ms`);
    assert.equal(batchResult.status, "success");
    assert.equal(batchResult.processedCount, 2);
    assert.equal(batchResult.skippedCount, 0);
    assert.equal((await prisma.orderRequest.findUniqueOrThrow({ where: { id: batchFirst.request.id } })).receivedQuantity, 2);
    assert.equal((await prisma.orderRequest.findUniqueOrThrow({ where: { id: batchSecond.request.id } })).receivedQuantity, 2);
    assert.equal(
      (await prisma.stockItem.findUniqueOrThrow({
        where: { clinicId_productId: { clinicId: clinic.id, productId: batchFirst.product.id } },
      })).quantity,
      4,
    );
    assert.equal(
      (await prisma.stockItem.findUniqueOrThrow({
        where: { clinicId_productId: { clinicId: clinic.id, productId: batchSecond.product.id } },
      })).quantity,
      3,
    );
    assert.equal(await prisma.orderRequest.count({ where: { memo: { contains: batchFirst.request.id }, receivedAt: null } }), 1);
    assert.equal(await prisma.orderRequest.count({ where: { memo: { contains: batchSecond.request.id }, receivedAt: null } }), 0);
    assert.equal(await prisma.stockMovement.count({ where: { sourceType: "ORDER_RECEIPT", sourceId: batchFirst.request.id } }), 1);
    assert.equal(await prisma.stockMovement.count({ where: { sourceType: "ORDER_RECEIPT", sourceId: batchSecond.request.id } }), 1);
    console.log(`T4: two-line batch receipt passed in ${batchMs}ms`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
