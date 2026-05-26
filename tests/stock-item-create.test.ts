import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { createStockItemForContext } = await import("../src/lib/actions/stock");

  try {
    const organization = await prisma.organization.create({
      data: {
        name: "Stock Item Create Test Organization",
      },
    });
    const otherOrganization = await prisma.organization.create({
      data: {
        name: "Other Stock Item Create Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Stock Item Create Test Clinic",
        isActive: true,
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Stock Item Create User",
        email: "stock-item-create-user@example.test",
        passwordHash: "test",
        role: "ADMIN",
        isActive: true,
      },
    });
    const product = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Stock Item Create Product",
        defaultMinStock: 3,
      },
    });
    const otherProduct = await prisma.product.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Organization Product",
        defaultMinStock: 1,
      },
    });
    const context = {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      organizationId: organization.id,
      clinicId: clinic.id,
      clinicName: clinic.name,
    };

    await createStockItemForContext(context, {
      productId: product.id,
      quantity: 5,
      minStock: 2,
      location: "Shelf A",
    });

    const stockItem = await prisma.stockItem.findUniqueOrThrow({
      where: {
        clinicId_productId: {
          clinicId: clinic.id,
          productId: product.id,
        },
      },
    });
    const movementCount = await prisma.stockMovement.count({
      where: {
        clinicId: clinic.id,
        productId: product.id,
      },
    });

    assert.equal(stockItem.quantity, 5);
    assert.equal(stockItem.minStock, 2);
    assert.equal(stockItem.location, "Shelf A");
    assert.equal(stockItem.isUsed, true);
    assert.equal(movementCount, 0);

    await assert.rejects(
      () =>
        createStockItemForContext(context, {
          productId: product.id,
          quantity: 1,
          minStock: 1,
          location: null,
        }),
      /既に作成/,
    );
    await assert.rejects(
      () =>
        createStockItemForContext(context, {
          productId: otherProduct.id,
          quantity: 1,
          minStock: 1,
          location: null,
        }),
      /商品が見つかりません/,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
