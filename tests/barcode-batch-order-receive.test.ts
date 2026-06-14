import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { resetTestDatabase } from "./helpers/db";

async function buildEan13(prefix12: string) {
  const { calculateEan13CheckDigit } = await import("../src/lib/barcode/ean13");
  const checkDigit = calculateEan13CheckDigit(prefix12);

  if (!checkDigit) {
    throw new Error("Invalid EAN prefix");
  }

  return `${prefix12}${checkDigit}`;
}

async function seedBase(prisma: PrismaClient) {
  const organization = await prisma.organization.create({
    data: {
      name: "Batch Receive Organization",
    },
  });
  const clinic = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Batch Receive Clinic",
    },
  });
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Batch Receive User",
      email: "batch-receive@example.test",
      passwordHash: "test-password-hash",
    },
  });

  await prisma.userClinicAssignment.create({
    data: {
      userId: user.id,
      clinicId: clinic.id,
    },
  });

  const staffOperator = await prisma.staffOperator.create({
    data: {
      organizationId: organization.id,
      displayName: "Batch Receive Staff",
      barcode: "STAFF-BATCH-RECEIVE",
      clinicAssignments: {
        create: {
          clinicId: clinic.id,
        },
      },
    },
  });
  const context = {
    userId: user.id,
    userName: user.name,
    organizationId: organization.id,
    clinicId: clinic.id,
    clinicName: clinic.name,
  };

  return {
    organization,
    clinic,
    user,
    staffOperator,
    context,
  };
}

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

  const orderRequest = await prisma.orderRequest.create({
    data: {
      clinicId: input.clinicId,
      productId: product.id,
      requestedQuantity: input.requestedQuantity,
      status: "ORDERED",
      orderedAt: new Date("2026-06-01T00:00:00.000Z"),
      createdByUserId: input.userId,
    },
  });

  return {
    product,
    orderRequest,
  };
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { batchOrderReceiveForContext, resolveBatchScanForContext } = await import("../src/lib/actions/barcode-batch");

  try {
    const base = await seedBase(prisma);
    const janCode = await buildEan13("490000000001");
    const secondJanCode = await buildEan13("490000000002");
    const first = await createOrderedProduct(prisma, {
      organizationId: base.organization.id,
      clinicId: base.clinic.id,
      userId: base.user.id,
      name: "Batch Receive Product A",
      janCode,
      stockQuantity: 2,
      requestedQuantity: 3,
    });
    const second = await createOrderedProduct(prisma, {
      organizationId: base.organization.id,
      clinicId: base.clinic.id,
      userId: base.user.id,
      name: "Batch Receive Product B",
      janCode: secondJanCode,
      stockQuantity: 1,
      requestedQuantity: 2,
    });

    const resolution = await resolveBatchScanForContext(base.context, {
      mode: "IN",
      barcode: `(01)0${janCode}(17)270531(10)LOT-BATCH-A`,
    });

    assert.equal(resolution.kind, "product");
    if (resolution.kind === "product") {
      assert.equal(resolution.status, "receivable");
      assert.equal(resolution.orderRequestId, first.orderRequest.id);
      assert.equal(resolution.lotNumber, "LOT-BATCH-A");
      assert.equal(resolution.expiryDateText, "270531");
    }

    const result = await batchOrderReceiveForContext(base.context, {
      staffOperatorId: base.staffOperator.id,
      lines: [
        {
          orderRequestId: first.orderRequest.id,
          barcode: janCode,
          receivedQuantity: 2,
          receivedMemo: "Batch receive",
          receivedLotNumber: "LOT-BATCH-A",
          receivedExpiryDateText: "2027-05-31",
        },
      ],
      revalidate: false,
    });

    assert.equal(result.status, "success");
    assert.equal(result.processedCount, 1);
    assert.equal(result.skippedCount, 0);

    const receivedRequest = await prisma.orderRequest.findUniqueOrThrow({
      where: {
        id: first.orderRequest.id,
      },
    });

    assert.equal(receivedRequest.receivedQuantity, 2);
    assert.notEqual(receivedRequest.receivedAt, null);
    assert.equal(receivedRequest.receivedByStaffId, base.staffOperator.id);

    const stockItem = await prisma.stockItem.findUniqueOrThrow({
      where: {
        clinicId_productId: {
          clinicId: base.clinic.id,
          productId: first.product.id,
        },
      },
    });

    assert.equal(stockItem.quantity, 4);
    assert.equal(
      await prisma.stockMovement.count({
        where: {
          clinicId: base.clinic.id,
          productId: first.product.id,
          sourceType: "ORDER_RECEIPT",
        },
      }),
      1,
    );
    assert.equal(
      await prisma.stockLot.count({
        where: {
          clinicId: base.clinic.id,
          productId: first.product.id,
          lotNumber: "LOT-BATCH-A",
          quantity: 2,
        },
      }),
      1,
    );

    const partialResult = await batchOrderReceiveForContext(base.context, {
      staffOperatorId: base.staffOperator.id,
      lines: [
        {
          orderRequestId: first.orderRequest.id,
          barcode: janCode,
          receivedQuantity: 1,
          receivedMemo: null,
          receivedLotNumber: null,
          receivedExpiryDateText: null,
        },
        {
          orderRequestId: second.orderRequest.id,
          barcode: secondJanCode,
          receivedQuantity: 2,
          receivedMemo: null,
          receivedLotNumber: null,
          receivedExpiryDateText: null,
        },
      ],
      revalidate: false,
    });

    assert.equal(partialResult.status, "success");
    assert.equal(partialResult.processedCount, 1);
    assert.equal(partialResult.skippedCount, 1);

    const secondStockItem = await prisma.stockItem.findUniqueOrThrow({
      where: {
        clinicId_productId: {
          clinicId: base.clinic.id,
          productId: second.product.id,
        },
      },
    });

    assert.equal(secondStockItem.quantity, 3);

    const overQuantityOrder = await createOrderedProduct(prisma, {
      organizationId: base.organization.id,
      clinicId: base.clinic.id,
      userId: base.user.id,
      name: "Batch Receive Product C",
      janCode: await buildEan13("490000000003"),
      stockQuantity: 0,
      requestedQuantity: 1,
    });

    await assert.rejects(() =>
      batchOrderReceiveForContext(base.context, {
        staffOperatorId: base.staffOperator.id,
        lines: [
          {
            orderRequestId: overQuantityOrder.orderRequest.id,
            barcode: overQuantityOrder.product.janCode!,
            receivedQuantity: 2,
            receivedMemo: null,
            receivedLotNumber: null,
            receivedExpiryDateText: null,
          },
        ],
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
