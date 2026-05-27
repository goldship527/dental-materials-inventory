import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { calculateStagnantDays, getDormantStockRows, normalizeDormantDays } = await import(
    "../src/lib/db/dormant-stock"
  );

  try {
    const today = new Date("2026-05-27T00:00:00.000Z");
    const organization = await prisma.organization.create({
      data: {
        name: "Dormant Stock Test Organization",
      },
    });
    const otherOrganization = await prisma.organization.create({
      data: {
        name: "Other Dormant Stock Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Dormant Stock Test Clinic",
      },
    });
    const otherClinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Other Dormant Stock Test Clinic",
      },
    });
    const otherOrganizationClinic = await prisma.clinic.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Organization Dormant Stock Test Clinic",
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Dormant Stock Test User",
        email: "dormant-stock@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const otherUser = await prisma.user.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Dormant Stock Test User",
        email: "other-dormant-stock@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const dormantProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Dormant Product",
        productCode: "DORMANT-001",
        janCode: "4900000000011",
        category: "Test Category",
        standardPrice: 120,
        defaultMinStock: 2,
      },
    });
    const neverOutProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Never Out Product",
        productCode: "DORMANT-002",
        defaultMinStock: 1,
      },
    });
    const recentOutProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Recent Out Product",
        defaultMinStock: 1,
      },
    });
    const boundaryProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Boundary Out Product",
        defaultMinStock: 1,
      },
    });
    const zeroStockProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Zero Stock Product",
        defaultMinStock: 1,
      },
    });
    const otherClinicProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Other Clinic Product",
        defaultMinStock: 1,
      },
    });
    const otherOrganizationProduct = await prisma.product.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Organization Product",
        defaultMinStock: 1,
      },
    });

    await prisma.stockItem.createMany({
      data: [
        {
          clinicId: clinic.id,
          productId: dormantProduct.id,
          quantity: 5,
          minStock: 2,
          location: "A shelf",
        },
        {
          clinicId: clinic.id,
          productId: neverOutProduct.id,
          quantity: 1,
          minStock: 1,
        },
        {
          clinicId: clinic.id,
          productId: recentOutProduct.id,
          quantity: 3,
          minStock: 1,
        },
        {
          clinicId: clinic.id,
          productId: boundaryProduct.id,
          quantity: 3,
          minStock: 1,
        },
        {
          clinicId: clinic.id,
          productId: zeroStockProduct.id,
          quantity: 0,
          minStock: 1,
        },
        {
          clinicId: otherClinic.id,
          productId: otherClinicProduct.id,
          quantity: 4,
          minStock: 1,
        },
        {
          clinicId: otherOrganizationClinic.id,
          productId: otherOrganizationProduct.id,
          quantity: 4,
          minStock: 1,
        },
      ],
    });

    await prisma.stockMovement.createMany({
      data: [
        {
          clinicId: clinic.id,
          productId: dormantProduct.id,
          movementType: "OUT",
          quantity: -1,
          beforeQuantity: 6,
          afterQuantity: 5,
          userId: user.id,
          createdAt: new Date("2026-02-25T00:00:00.000Z"),
        },
        {
          clinicId: clinic.id,
          productId: recentOutProduct.id,
          movementType: "OUT",
          quantity: -1,
          beforeQuantity: 4,
          afterQuantity: 3,
          userId: user.id,
          createdAt: new Date("2026-05-01T00:00:00.000Z"),
        },
        {
          clinicId: clinic.id,
          productId: boundaryProduct.id,
          movementType: "OUT",
          quantity: -1,
          beforeQuantity: 4,
          afterQuantity: 3,
          userId: user.id,
          createdAt: new Date("2026-02-26T00:00:00.000Z"),
        },
        {
          clinicId: otherClinic.id,
          productId: otherClinicProduct.id,
          movementType: "OUT",
          quantity: -1,
          beforeQuantity: 5,
          afterQuantity: 4,
          userId: user.id,
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
        },
        {
          clinicId: otherOrganizationClinic.id,
          productId: otherOrganizationProduct.id,
          movementType: "OUT",
          quantity: -1,
          beforeQuantity: 5,
          afterQuantity: 4,
          userId: otherUser.id,
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      ],
    });

    const rows = await getDormantStockRows(organization.id, clinic.id, 90, { today });
    const productIds = rows.map((row) => row.productId);

    assert.deepEqual(new Set(productIds), new Set([dormantProduct.id, neverOutProduct.id]));
    assert.equal(productIds.includes(recentOutProduct.id), false);
    assert.equal(productIds.includes(boundaryProduct.id), false);
    assert.equal(productIds.includes(zeroStockProduct.id), false);
    assert.equal(productIds.includes(otherClinicProduct.id), false);
    assert.equal(productIds.includes(otherOrganizationProduct.id), false);

    const dormantRow = rows.find((row) => row.productId === dormantProduct.id);
    assert.equal(dormantRow?.stagnantDays, 91);
    assert.equal(dormantRow?.stagnantAmount, 600);
    assert.equal(dormantRow?.lastOutAt?.toISOString(), "2026-02-25T00:00:00.000Z");

    const neverOutRow = rows.find((row) => row.productId === neverOutProduct.id);
    assert.equal(neverOutRow?.lastOutAt, null);
    assert.equal(neverOutRow?.stagnantDays, null);

    assert.equal(calculateStagnantDays(new Date("2026-05-17T00:00:00.000Z"), today), 10);
    assert.equal(calculateStagnantDays(null, today), null);
    assert.equal(normalizeDormantDays("180"), 180);
    assert.equal(normalizeDormantDays("365"), 365);
    assert.equal(normalizeDormantDays("bad"), 90);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
