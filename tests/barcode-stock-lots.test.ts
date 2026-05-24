import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { resetTestDatabase } from "./helpers/db";

const productJan = "4900000000009";
const gs1Input = `(01)0${productJan}(17)270531(10)LOT123`;

async function seedTestData(prisma: PrismaClient) {
  const organization = await prisma.organization.create({
    data: {
      name: "Test Organization",
    },
  });
  const clinic = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Test Clinic",
    },
  });
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Test User",
      email: "barcode-stock-lot-test@example.com",
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
      displayName: "Test Staff",
      barcode: "STAFF-LOT-001",
      operatorType: "REGULAR",
      clinicAssignments: {
        create: {
          clinicId: clinic.id,
        },
      },
    },
  });

  const product = await prisma.product.create({
    data: {
      organizationId: organization.id,
      productCode: "LOT-TEST-001",
      janCode: productJan,
      name: "Lot Test Product",
      defaultMinStock: 1,
    },
  });

  await prisma.stockItem.create({
    data: {
      clinicId: clinic.id,
      productId: product.id,
      quantity: 2,
      minStock: 1,
      location: "Test shelf",
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
    clinic,
    product,
    context,
    staffOperator,
  };
}

async function getStockQuantity(prisma: PrismaClient, clinicId: string, productId: string) {
  const stockItem = await prisma.stockItem.findUniqueOrThrow({
    where: {
      clinicId_productId: {
        clinicId,
        productId,
      },
    },
  });

  return stockItem.quantity;
}

async function getLotQuantity(prisma: PrismaClient, clinicId: string, productId: string) {
  const lot = await prisma.stockLot.findUniqueOrThrow({
    where: {
      clinicId_productId_lotNumber_expiryDateText: {
        clinicId,
        productId,
        lotNumber: "LOT123",
        expiryDateText: "270531",
      },
    },
  });

  return lot.quantity;
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { barcodeStockMoveForContext } = await import("../src/lib/actions/barcode-stock");
  const { revertStockMovementForContext } = await import("../src/lib/actions/stock-movements");

  try {
    const data = await seedTestData(prisma);
    const baseInput = {
      staffBarcode: data.staffOperator.barcode,
      barcode: gs1Input,
      productId: data.product.id,
      reason: "納品",
      reasonNote: "",
    };

    await barcodeStockMoveForContext({
      context: data.context,
      input: {
        ...baseInput,
        movementType: "IN",
        quantity: 3,
      },
      revalidate: false,
    });

    assert.equal(await getStockQuantity(prisma, data.clinic.id, data.product.id), 5);
    assert.equal(await getLotQuantity(prisma, data.clinic.id, data.product.id), 3);

    const firstMovement = await prisma.stockMovement.findFirstOrThrow({
      where: {
        clinicId: data.clinic.id,
        productId: data.product.id,
        sourceType: "BARCODE_STOCK",
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    assert.equal(firstMovement.lotNumber, "LOT123");
    assert.equal(firstMovement.expiryDateText, "270531");
    assert.ok(firstMovement.expiryDate instanceof Date);
    assert.equal(firstMovement.performedByStaffId, data.staffOperator.id);

    await barcodeStockMoveForContext({
      context: data.context,
      input: {
        ...baseInput,
        movementType: "IN",
        quantity: 2,
      },
      revalidate: false,
    });

    assert.equal(await getStockQuantity(prisma, data.clinic.id, data.product.id), 7);
    assert.equal(await getLotQuantity(prisma, data.clinic.id, data.product.id), 5);

    await barcodeStockMoveForContext({
      context: data.context,
      input: {
        ...baseInput,
        movementType: "OUT",
        quantity: 4,
        reason: "使用",
      },
      revalidate: false,
    });

    assert.equal(await getStockQuantity(prisma, data.clinic.id, data.product.id), 3);
    assert.equal(await getLotQuantity(prisma, data.clinic.id, data.product.id), 1);

    await assert.rejects(() =>
      barcodeStockMoveForContext({
        context: data.context,
        input: {
          ...baseInput,
          movementType: "OUT",
          quantity: 2,
          reason: "使用",
        },
        revalidate: false,
      }),
    );

    assert.equal(await getStockQuantity(prisma, data.clinic.id, data.product.id), 3);
    assert.equal(await getLotQuantity(prisma, data.clinic.id, data.product.id), 1);

    const outMovement = await prisma.stockMovement.findFirstOrThrow({
      where: {
        clinicId: data.clinic.id,
        productId: data.product.id,
        movementType: "OUT",
        sourceType: "BARCODE_STOCK",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    await revertStockMovementForContext({
      context: data.context,
      movementId: outMovement.id,
      revalidate: false,
    });

    assert.equal(await getStockQuantity(prisma, data.clinic.id, data.product.id), 7);
    assert.equal(await getLotQuantity(prisma, data.clinic.id, data.product.id), 5);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
