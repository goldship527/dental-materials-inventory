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
      email: `movement-${Date.now()}@example.test`,
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

async function createProductWithMovement(
  prisma: typeof import("../src/lib/db/prisma").prisma,
  input: {
    organizationId: string;
    clinicId: string;
    userId: string;
    name: string;
    beforeQuantity: number;
    afterQuantity: number;
    sourceType?: string | null;
    revertedAt?: Date | null;
    revertOfId?: string | null;
    currentQuantity?: number;
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

  await prisma.stockItem.create({
    data: {
      clinicId: input.clinicId,
      productId: product.id,
      quantity: input.currentQuantity ?? input.afterQuantity,
      minStock: 1,
      location: "Test shelf",
    },
  });

  const movement = await prisma.stockMovement.create({
    data: {
      clinicId: input.clinicId,
      productId: product.id,
      movementType: "ADJUST",
      quantity: input.afterQuantity - input.beforeQuantity,
      beforeQuantity: input.beforeQuantity,
      afterQuantity: input.afterQuantity,
      sourceType: input.sourceType ?? "MANUAL",
      revertOfId: input.revertOfId ?? null,
      revertedAt: input.revertedAt ?? null,
      userId: input.userId,
    },
  });

  return {
    product,
    movement,
  };
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { revertStockMovementForContext } = await import("../src/lib/actions/stock-movements");

  try {
    const data = await seedBase(prisma);
    const normal = await createProductWithMovement(prisma, {
      organizationId: data.organization.id,
      clinicId: data.clinic.id,
      userId: data.user.id,
      name: "Movement normal",
      beforeQuantity: 5,
      afterQuantity: 8,
    });

    await revertStockMovementForContext({
      context: data.context,
      movementId: normal.movement.id,
      revalidate: false,
    });

    const revertedStock = await prisma.stockItem.findUniqueOrThrow({
      where: {
        clinicId_productId: {
          clinicId: data.clinic.id,
          productId: normal.product.id,
        },
      },
    });
    const originalMovement = await prisma.stockMovement.findUniqueOrThrow({
      where: {
        id: normal.movement.id,
      },
    });
    const revertMovement = await prisma.stockMovement.findFirstOrThrow({
      where: {
        revertOfId: normal.movement.id,
      },
    });

    assert.equal(revertedStock.quantity, 5);
    assert.notEqual(originalMovement.revertedAt, null);
    assert.equal(originalMovement.revertedById, data.user.id);
    assert.equal(revertMovement.sourceType, "REVERT");
    assert.equal(revertMovement.sourceId, normal.movement.id);
    assert.equal(revertMovement.beforeQuantity, 8);
    assert.equal(revertMovement.afterQuantity, 5);

    const fromStocktake = await createProductWithMovement(prisma, {
      organizationId: data.organization.id,
      clinicId: data.clinic.id,
      userId: data.user.id,
      name: "Movement stocktake",
      beforeQuantity: 1,
      afterQuantity: 2,
      sourceType: "STOCKTAKE_SESSION",
    });

    await assert.rejects(() =>
      revertStockMovementForContext({
        context: data.context,
        movementId: fromStocktake.movement.id,
        revalidate: false,
      }),
    );

    const alreadyReverted = await createProductWithMovement(prisma, {
      organizationId: data.organization.id,
      clinicId: data.clinic.id,
      userId: data.user.id,
      name: "Movement already reverted",
      beforeQuantity: 2,
      afterQuantity: 3,
      revertedAt: new Date(),
    });

    await assert.rejects(() =>
      revertStockMovementForContext({
        context: data.context,
        movementId: alreadyReverted.movement.id,
        revalidate: false,
      }),
    );

    const revertRecord = await createProductWithMovement(prisma, {
      organizationId: data.organization.id,
      clinicId: data.clinic.id,
      userId: data.user.id,
      name: "Movement revert record",
      beforeQuantity: 3,
      afterQuantity: 2,
      sourceType: "REVERT",
      revertOfId: normal.movement.id,
    });

    await assert.rejects(() =>
      revertStockMovementForContext({
        context: data.context,
        movementId: revertRecord.movement.id,
        revalidate: false,
      }),
    );

    const staleStock = await createProductWithMovement(prisma, {
      organizationId: data.organization.id,
      clinicId: data.clinic.id,
      userId: data.user.id,
      name: "Movement stale stock",
      beforeQuantity: 4,
      afterQuantity: 7,
      currentQuantity: 9,
    });

    await assert.rejects(() =>
      revertStockMovementForContext({
        context: data.context,
        movementId: staleStock.movement.id,
        revalidate: false,
      }),
    );

    const staleStockAfter = await prisma.stockItem.findUniqueOrThrow({
      where: {
        clinicId_productId: {
          clinicId: data.clinic.id,
          productId: staleStock.product.id,
        },
      },
    });

    assert.equal(staleStockAfter.quantity, 9);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
