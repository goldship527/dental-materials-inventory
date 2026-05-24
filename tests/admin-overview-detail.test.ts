import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { resetTestDatabase } from "./helpers/db";

async function seedBase(prisma: typeof import("../src/lib/db/prisma").prisma) {
  const organization = await prisma.organization.create({
    data: {
      name: "Admin Overview Detail Organization",
    },
  });
  const otherOrganization = await prisma.organization.create({
    data: {
      name: "Other Admin Overview Detail Organization",
    },
  });
  const admin = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Admin Overview Detail User",
      email: "admin-overview-detail@example.test",
      passwordHash: await bcrypt.hash("AdminOverviewDetail123!", 12),
      role: "ADMIN",
      isActive: true,
    },
  });
  const clinic = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Admin Detail Clinic",
      address: "Sample Address",
      phone: "03-0000-0000",
    },
  });
  const inactiveClinic = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Inactive Admin Detail Clinic",
      isActive: false,
    },
  });
  const otherClinic = await prisma.clinic.create({
    data: {
      organizationId: otherOrganization.id,
      name: "Other Admin Detail Clinic",
    },
  });
  const supplier = await prisma.supplier.create({
    data: {
      organizationId: organization.id,
      name: "Admin Detail Supplier",
    },
  });
  const shortageProduct = await prisma.product.create({
    data: {
      organizationId: organization.id,
      primarySupplierId: supplier.id,
      name: "Shortage Detail Product",
      productCode: "AD-001",
      janCode: "4900000000011",
      category: "Test Category",
      defaultMinStock: 5,
    },
  });
  const enoughProduct = await prisma.product.create({
    data: {
      organizationId: organization.id,
      name: "Enough Detail Product",
      productCode: "AD-002",
      category: "Other Category",
      defaultMinStock: 2,
    },
  });

  await prisma.stockItem.createMany({
    data: [
      {
        clinicId: clinic.id,
        productId: shortageProduct.id,
        quantity: 1,
        minStock: 5,
        location: "Shelf A",
      },
      {
        clinicId: clinic.id,
        productId: enoughProduct.id,
        quantity: 3,
        minStock: 2,
        location: "Shelf B",
      },
    ],
  });
  await prisma.stockLot.create({
    data: {
      clinicId: clinic.id,
      productId: shortageProduct.id,
      lotNumber: "LOT-A",
      expiryDateText: "2026-01-01",
      expiryDate: new Date("2026-01-01T00:00:00.000Z"),
      quantity: 1,
    },
  });
  await prisma.orderRequest.create({
    data: {
      clinicId: clinic.id,
      productId: shortageProduct.id,
      supplierId: supplier.id,
      status: "DRAFT",
      requestedQuantity: 4,
      createdByUserId: admin.id,
    },
  });
  await prisma.stockMovement.create({
    data: {
      clinicId: clinic.id,
      productId: shortageProduct.id,
      movementType: "OUT",
      quantity: -1,
      beforeQuantity: 2,
      afterQuantity: 1,
      reason: "test",
      userId: admin.id,
    },
  });

  return {
    organization,
    clinic,
    inactiveClinic,
    otherClinic,
  };
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { getAdminOverviewClinicDetail } = await import("../src/lib/db/admin-overview");

  try {
    const data = await seedBase(prisma);
    const detail = await getAdminOverviewClinicDetail(data.organization.id, data.clinic.id);

    assert.ok(detail);
    assert.equal(detail.clinic.name, "Admin Detail Clinic");
    assert.equal(detail.summary.stockItemCount, 2);
    assert.equal(detail.summary.totalQuantity, 4);
    assert.equal(detail.summary.shortageCount, 1);
    assert.equal(detail.summary.zeroStockCount, 0);
    assert.equal(detail.summary.attentionStockLotCount, 1);
    assert.equal(detail.orderStatusCounts.DRAFT, 1);
    assert.deepEqual(detail.categories, ["Other Category", "Test Category"]);
    assert.equal(
      detail.stockRows.find((row) => row.name === "Shortage Detail Product")?.supplierName,
      "Admin Detail Supplier",
    );
    assert.equal(detail.attentionStockLotRows[0]?.lotNumber, "LOT-A");

    assert.equal(await getAdminOverviewClinicDetail(data.organization.id, data.otherClinic.id), null);
    assert.equal(await getAdminOverviewClinicDetail(data.organization.id, data.inactiveClinic.id), null);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
