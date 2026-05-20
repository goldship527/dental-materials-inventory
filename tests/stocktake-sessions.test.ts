import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function seedBase(prisma: typeof import("../src/lib/db/prisma").prisma) {
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
      email: `stocktake-${Date.now()}@example.test`,
      passwordHash: "test-password-hash",
    },
  });

  await prisma.userClinicAssignment.create({
    data: {
      userId: user.id,
      clinicId: clinic.id,
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
    context,
  };
}

async function createProductWithStock(
  prisma: typeof import("../src/lib/db/prisma").prisma,
  input: {
    organizationId: string;
    clinicId: string;
    name: string;
    quantity: number;
  },
) {
  const product = await prisma.product.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      productCode: input.name,
      defaultMinStock: 1,
    },
  });

  const stockItem = await prisma.stockItem.create({
    data: {
      clinicId: input.clinicId,
      productId: product.id,
      quantity: input.quantity,
      minStock: 1,
      location: "Test shelf",
    },
  });

  return {
    product,
    stockItem,
  };
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { commitStocktakeSessionForContext } = await import("../src/lib/actions/stocktake-sessions");

  try {
    const data = await seedBase(prisma);
    const countedChanged = await createProductWithStock(prisma, {
      organizationId: data.organization.id,
      clinicId: data.clinic.id,
      name: "Stocktake counted changed",
      quantity: 5,
    });
    const countedSame = await createProductWithStock(prisma, {
      organizationId: data.organization.id,
      clinicId: data.clinic.id,
      name: "Stocktake counted same",
      quantity: 3,
    });
    const pending = await createProductWithStock(prisma, {
      organizationId: data.organization.id,
      clinicId: data.clinic.id,
      name: "Stocktake pending",
      quantity: 9,
    });
    const session = await prisma.stocktakeSession.create({
      data: {
        clinicId: data.clinic.id,
        startedByUserId: data.user.id,
      },
    });

    await prisma.stocktakeSessionItem.createMany({
      data: [
        {
          sessionId: session.id,
          productId: countedChanged.product.id,
          expectedQuantity: 5,
          countedQuantity: 7,
          diff: 2,
          status: "COUNTED",
          countedByUserId: data.user.id,
          countedAt: new Date(),
        },
        {
          sessionId: session.id,
          productId: countedSame.product.id,
          expectedQuantity: 3,
          countedQuantity: 3,
          diff: 0,
          status: "COUNTED",
          countedByUserId: data.user.id,
          countedAt: new Date(),
        },
        {
          sessionId: session.id,
          productId: pending.product.id,
          expectedQuantity: 9,
          status: "PENDING",
        },
      ],
    });

    await commitStocktakeSessionForContext({
      context: data.context,
      sessionId: session.id,
      revalidate: false,
    });

    const committedSession = await prisma.stocktakeSession.findUniqueOrThrow({
      where: {
        id: session.id,
      },
    });
    const changedStock = await prisma.stockItem.findUniqueOrThrow({
      where: {
        clinicId_productId: {
          clinicId: data.clinic.id,
          productId: countedChanged.product.id,
        },
      },
    });
    const sameStock = await prisma.stockItem.findUniqueOrThrow({
      where: {
        clinicId_productId: {
          clinicId: data.clinic.id,
          productId: countedSame.product.id,
        },
      },
    });
    const pendingStock = await prisma.stockItem.findUniqueOrThrow({
      where: {
        clinicId_productId: {
          clinicId: data.clinic.id,
          productId: pending.product.id,
        },
      },
    });
    const movements = await prisma.stockMovement.findMany({
      where: {
        clinicId: data.clinic.id,
      },
      orderBy: {
        productId: "asc",
      },
    });

    assert.equal(committedSession.status, "COMMITTED");
    assert.notEqual(committedSession.committedAt, null);
    assert.equal(committedSession.committedByUserId, data.user.id);
    assert.equal(changedStock.quantity, 7);
    assert.equal(sameStock.quantity, 3);
    assert.equal(pendingStock.quantity, 9);
    assert.equal(movements.length, 1);
    assert.equal(movements[0]?.productId, countedChanged.product.id);
    assert.equal(movements[0]?.sourceType, "STOCKTAKE_SESSION");
    assert.equal(movements[0]?.sourceId, session.id);
    assert.equal(movements[0]?.beforeQuantity, 5);
    assert.equal(movements[0]?.afterQuantity, 7);

    const conflictProduct = await createProductWithStock(prisma, {
      organizationId: data.organization.id,
      clinicId: data.clinic.id,
      name: "Stocktake conflict",
      quantity: 4,
    });
    const conflictSession = await prisma.stocktakeSession.create({
      data: {
        clinicId: data.clinic.id,
        startedByUserId: data.user.id,
      },
    });

    await prisma.stocktakeSessionItem.create({
      data: {
        sessionId: conflictSession.id,
        productId: conflictProduct.product.id,
        expectedQuantity: 4,
        countedQuantity: 8,
        diff: 4,
        status: "COUNTED",
        countedByUserId: data.user.id,
        countedAt: new Date(),
      },
    });
    await prisma.stockItem.update({
      where: {
        clinicId_productId: {
          clinicId: data.clinic.id,
          productId: conflictProduct.product.id,
        },
      },
      data: {
        quantity: 6,
      },
    });

    await assert.rejects(() =>
      commitStocktakeSessionForContext({
        context: data.context,
        sessionId: conflictSession.id,
        revalidate: false,
      }),
    );

    const rolledBackSession = await prisma.stocktakeSession.findUniqueOrThrow({
      where: {
        id: conflictSession.id,
      },
    });
    const rolledBackStock = await prisma.stockItem.findUniqueOrThrow({
      where: {
        clinicId_productId: {
          clinicId: data.clinic.id,
          productId: conflictProduct.product.id,
        },
      },
    });
    const conflictMovements = await prisma.stockMovement.count({
      where: {
        sourceId: conflictSession.id,
      },
    });

    assert.equal(rolledBackSession.status, "IN_PROGRESS");
    assert.equal(rolledBackSession.committedAt, null);
    assert.equal(rolledBackStock.quantity, 6);
    assert.equal(conflictMovements, 0);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
