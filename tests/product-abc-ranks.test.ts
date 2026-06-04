import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { calculateProductAbcRanks, getProductAbcRanks } = await import("../src/lib/db/product-abc-ranks");

  try {
    const today = new Date("2026-05-27T00:00:00.000Z");
    const organization = await prisma.organization.create({
      data: {
        name: "Product ABC Test Organization",
      },
    });
    const otherOrganization = await prisma.organization.create({
      data: {
        name: "Other Product ABC Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Product ABC Test Clinic",
      },
    });
    const otherClinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Other Product ABC Test Clinic",
      },
    });
    const otherOrganizationClinic = await prisma.clinic.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Organization Product ABC Test Clinic",
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Product ABC Test User",
        email: "product-abc@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const otherUser = await prisma.user.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Product ABC Test User",
        email: "other-product-abc@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const productA = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "ABC Product A",
        defaultMinStock: 1,
      },
    });
    const productB = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "ABC Product B",
        defaultMinStock: 1,
      },
    });
    const productC = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "ABC Product C",
        defaultMinStock: 1,
      },
    });
    const unusedProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "ABC Unused Product",
        defaultMinStock: 1,
      },
    });
    const inactiveProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "ABC Inactive Product",
        defaultMinStock: 1,
        isActive: false,
      },
    });
    const otherOrganizationProduct = await prisma.product.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Organization ABC Product",
        defaultMinStock: 1,
      },
    });

    await prisma.stockMovement.createMany({
      data: [
        {
          clinicId: clinic.id,
          productId: productA.id,
          movementType: "OUT",
          quantity: -7,
          beforeQuantity: 10,
          afterQuantity: 3,
          userId: user.id,
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
        },
        {
          clinicId: clinic.id,
          productId: productB.id,
          movementType: "OUT",
          quantity: -2,
          beforeQuantity: 5,
          afterQuantity: 3,
          userId: user.id,
          createdAt: new Date("2026-05-02T00:00:00.000Z"),
        },
        {
          clinicId: clinic.id,
          productId: productC.id,
          movementType: "OUT",
          quantity: -1,
          beforeQuantity: 2,
          afterQuantity: 1,
          userId: user.id,
          createdAt: new Date("2026-05-03T00:00:00.000Z"),
        },
        {
          clinicId: clinic.id,
          productId: productA.id,
          movementType: "IN",
          quantity: 99,
          beforeQuantity: 3,
          afterQuantity: 102,
          userId: user.id,
          createdAt: new Date("2026-05-04T00:00:00.000Z"),
        },
        {
          clinicId: clinic.id,
          productId: productA.id,
          movementType: "OUT",
          quantity: -99,
          beforeQuantity: 102,
          afterQuantity: 3,
          userId: user.id,
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
        },
        {
          clinicId: otherClinic.id,
          productId: unusedProduct.id,
          movementType: "OUT",
          quantity: -99,
          beforeQuantity: 99,
          afterQuantity: 0,
          userId: user.id,
          createdAt: new Date("2026-05-05T00:00:00.000Z"),
        },
        {
          clinicId: clinic.id,
          productId: inactiveProduct.id,
          movementType: "OUT",
          quantity: -99,
          beforeQuantity: 99,
          afterQuantity: 0,
          userId: user.id,
          createdAt: new Date("2026-05-06T00:00:00.000Z"),
        },
        {
          clinicId: otherOrganizationClinic.id,
          productId: otherOrganizationProduct.id,
          movementType: "OUT",
          quantity: -99,
          beforeQuantity: 99,
          afterQuantity: 0,
          userId: otherUser.id,
          createdAt: new Date("2026-05-07T00:00:00.000Z"),
        },
      ],
    });

    const ranks = await getProductAbcRanks(organization.id, clinic.id, { today });

    assert.deepEqual(ranks[productA.id], {
      rank: "A",
      totalQuantity: 7,
      share: 0.7,
    });
    assert.deepEqual(ranks[productB.id], {
      rank: "B",
      totalQuantity: 2,
      share: 0.2,
    });
    assert.deepEqual(ranks[productC.id], {
      rank: "C",
      totalQuantity: 1,
      share: 0.1,
    });
    assert.deepEqual(ranks[unusedProduct.id], {
      rank: "UNUSED",
      totalQuantity: 0,
      share: 0,
    });
    assert.equal(ranks[inactiveProduct.id], undefined);
    assert.equal(ranks[otherOrganizationProduct.id], undefined);

    assert.deepEqual(calculateProductAbcRanks([
      { productId: "a", totalQuantity: 60 },
      { productId: "b", totalQuantity: 20 },
      { productId: "c", totalQuantity: 15 },
      { productId: "d", totalQuantity: 5 },
      { productId: "unused", totalQuantity: 0 },
    ]), {
      a: {
        rank: "A",
        totalQuantity: 60,
        share: 0.6,
      },
      b: {
        rank: "A",
        totalQuantity: 20,
        share: 0.2,
      },
      c: {
        rank: "B",
        totalQuantity: 15,
        share: 0.15,
      },
      d: {
        rank: "C",
        totalQuantity: 5,
        share: 0.05,
      },
      unused: {
        rank: "UNUSED",
        totalQuantity: 0,
        share: 0,
      },
    });
    assert.deepEqual(calculateProductAbcRanks([
      { productId: "zero-a", totalQuantity: 0 },
      { productId: "zero-b", totalQuantity: 0 },
    ]), {
      "zero-a": {
        rank: "UNUSED",
        totalQuantity: 0,
        share: 0,
      },
      "zero-b": {
        rank: "UNUSED",
        totalQuantity: 0,
        share: 0,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
