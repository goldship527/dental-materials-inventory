import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { adjustStockForContext } = await import("../src/lib/actions/stock");

  try {
    const organization = await prisma.organization.create({
      data: {
        name: "Stock Optimistic Lock Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Stock Optimistic Lock Test Clinic",
        isActive: true,
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Stock Optimistic Lock User",
        email: "stock-optimistic-lock-user@example.test",
        passwordHash: await bcrypt.hash("StockLock123!", 12),
        role: "ADMIN",
        isActive: true,
      },
    });
    const product = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Lock Target Product",
        defaultMinStock: 2,
      },
    });
    const stockItem = await prisma.stockItem.create({
      data: {
        clinicId: clinic.id,
        productId: product.id,
        quantity: 10,
        minStock: 2,
        isUsed: true,
      },
    });
    const staffOperator = await prisma.staffOperator.create({
      data: {
        organizationId: organization.id,
        displayName: "Stock Lock Staff",
        barcode: "STAFF-STOCK-LOCK",
        operatorType: "REGULAR",
        clinicAssignments: {
          create: {
            clinicId: clinic.id,
          },
        },
      },
    });
    const firstView = await prisma.stockItem.findUniqueOrThrow({
      where: {
        id: stockItem.id,
      },
      select: {
        quantity: true,
        updatedAt: true,
      },
    });
    const context = {
      userId: user.id,
      userName: user.name,
      organizationId: organization.id,
      clinicId: clinic.id,
      clinicName: clinic.name,
    };

    const success = await adjustStockForContext(context, {
      stockItemId: stockItem.id,
      quantity: 8,
      reason: "先行更新",
      sourceType: "MANUAL",
      expectedQuantity: firstView.quantity,
      expectedUpdatedAt: firstView.updatedAt.getTime(),
      staffOperatorId: staffOperator.id,
    });
    const afterSuccess = await prisma.stockItem.findUniqueOrThrow({
      where: {
        id: stockItem.id,
      },
      select: {
        quantity: true,
      },
    });

    assert.equal(success.beforeQuantity, 10);
    assert.equal(success.afterQuantity, 8);
    assert.equal(afterSuccess.quantity, 8);

    await assert.rejects(
      () =>
        adjustStockForContext(context, {
          stockItemId: stockItem.id,
          quantity: 12,
          reason: "古い画面から更新",
          sourceType: "MANUAL",
          expectedQuantity: firstView.quantity,
          expectedUpdatedAt: firstView.updatedAt.getTime(),
          staffOperatorId: staffOperator.id,
        }),
      /他のスタッフが先に在庫を変更しました/,
    );

    const finalStockItem = await prisma.stockItem.findUniqueOrThrow({
      where: {
        id: stockItem.id,
      },
      select: {
        quantity: true,
      },
    });
    const movementCount = await prisma.stockMovement.count({
      where: {
        clinicId: clinic.id,
        productId: product.id,
      },
    });
    const movement = await prisma.stockMovement.findFirstOrThrow({
      where: {
        clinicId: clinic.id,
        productId: product.id,
      },
    });

    assert.equal(finalStockItem.quantity, 8);
    assert.equal(movementCount, 1);
    assert.equal(movement.performedByStaffId, staffOperator.id);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
