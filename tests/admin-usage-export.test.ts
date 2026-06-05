import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { resetTestDatabase } from "./helpers/db";

async function seedBase(prisma: typeof import("../src/lib/db/prisma").prisma) {
  const organization = await prisma.organization.create({
    data: {
      name: "Admin Usage Export Organization",
    },
  });
  const otherOrganization = await prisma.organization.create({
    data: {
      name: "Other Admin Usage Export Organization",
    },
  });
  const admin = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Admin Usage Export User",
      email: "admin-usage-export@example.test",
      passwordHash: await bcrypt.hash("AdminUsageExport123!", 12),
      role: "ADMIN",
      isActive: true,
    },
  });
  const otherAdmin = await prisma.user.create({
    data: {
      organizationId: otherOrganization.id,
      name: "Other Admin Usage Export User",
      email: "other-admin-usage-export@example.test",
      passwordHash: await bcrypt.hash("AdminUsageExport123!", 12),
      role: "ADMIN",
      isActive: true,
    },
  });
  const clinicA = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Clinic A",
    },
  });
  const clinicB = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Clinic B",
    },
  });
  const inactiveClinic = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Inactive Clinic",
      isActive: false,
    },
  });
  const otherClinic = await prisma.clinic.create({
    data: {
      organizationId: otherOrganization.id,
      name: "Other Clinic",
    },
  });
  const productA = await prisma.product.create({
    data: {
      organizationId: organization.id,
      name: "=Risk Product",
      productCode: "UE-001",
      janCode: "4900000000011",
      category: "Material",
      manufacturer: "Sample Maker",
      defaultMinStock: 1,
    },
  });
  const productB = await prisma.product.create({
    data: {
      organizationId: organization.id,
      name: "Normal Product",
      productCode: "UE-002",
      category: "Tool",
      defaultMinStock: 1,
    },
  });
  const otherProduct = await prisma.product.create({
    data: {
      organizationId: otherOrganization.id,
      name: "Other Product",
      productCode: "OTHER-001",
      defaultMinStock: 1,
    },
  });

  await prisma.stockMovement.createMany({
    data: [
      {
        clinicId: clinicA.id,
        productId: productA.id,
        movementType: "OUT",
        quantity: -2,
        beforeQuantity: 10,
        afterQuantity: 8,
        reason: "use",
        userId: admin.id,
        createdAt: new Date("2026-05-10T09:00:00+09:00"),
      },
      {
        clinicId: clinicA.id,
        productId: productA.id,
        movementType: "OUT",
        quantity: 6,
        beforeQuantity: 11,
        afterQuantity: 5,
        reason: "legacy positive out",
        userId: admin.id,
        createdAt: new Date("2026-05-11T10:00:00+09:00"),
      },
      {
        clinicId: clinicA.id,
        productId: productA.id,
        movementType: "OUT",
        quantity: -3,
        beforeQuantity: 8,
        afterQuantity: 5,
        reason: "use",
        userId: admin.id,
        createdAt: new Date("2026-05-11T09:00:00+09:00"),
      },
      {
        clinicId: clinicB.id,
        productId: productA.id,
        movementType: "OUT",
        quantity: -4,
        beforeQuantity: 9,
        afterQuantity: 5,
        reason: "use",
        userId: admin.id,
        createdAt: new Date("2026-05-12T09:00:00+09:00"),
      },
      {
        clinicId: clinicB.id,
        productId: productB.id,
        movementType: "OUT",
        quantity: -1,
        beforeQuantity: 3,
        afterQuantity: 2,
        reason: "use",
        userId: admin.id,
        createdAt: new Date("2026-05-13T09:00:00+09:00"),
      },
      {
        clinicId: clinicA.id,
        productId: productA.id,
        movementType: "IN",
        quantity: 10,
        beforeQuantity: 0,
        afterQuantity: 10,
        reason: "in",
        userId: admin.id,
        createdAt: new Date("2026-05-10T09:00:00+09:00"),
      },
      {
        clinicId: clinicA.id,
        productId: productA.id,
        movementType: "OUT",
        quantity: -9,
        beforeQuantity: 9,
        afterQuantity: 0,
        reason: "outside range",
        userId: admin.id,
        createdAt: new Date("2026-04-30T09:00:00+09:00"),
      },
      {
        clinicId: inactiveClinic.id,
        productId: productA.id,
        movementType: "OUT",
        quantity: -99,
        beforeQuantity: 99,
        afterQuantity: 0,
        reason: "inactive",
        userId: admin.id,
        createdAt: new Date("2026-05-10T09:00:00+09:00"),
      },
      {
        clinicId: otherClinic.id,
        productId: otherProduct.id,
        movementType: "OUT",
        quantity: -88,
        beforeQuantity: 88,
        afterQuantity: 0,
        reason: "other org",
        userId: otherAdmin.id,
        createdAt: new Date("2026-05-10T09:00:00+09:00"),
      },
    ],
  });

  return {
    organization,
    productA,
    productB,
  };
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { getAdminUsageExportRows, parseAdminUsageExportDateRange } = await import(
    "../src/lib/db/admin-usage-export"
  );
  const { buildAdminUsageExportCsv } = await import("../src/lib/exports/admin-usage-export-csv");

  try {
    const data = await seedBase(prisma);
    const dateRange = parseAdminUsageExportDateRange({
      startDate: "2026-05-01",
      endDate: "2026-05-31",
    });
    const rows = await getAdminUsageExportRows({
      organizationId: data.organization.id,
      dateRange,
    });
    const totalProductA = rows.find(
      (row) => row.scope === "ORGANIZATION_TOTAL" && row.productId === data.productA.id,
    );
    const clinicAProductA = rows.find((row) => row.scope === "CLINIC" && row.clinicName === "Clinic A");
    const totalProductB = rows.find(
      (row) => row.scope === "ORGANIZATION_TOTAL" && row.productId === data.productB.id,
    );

    assert.equal(totalProductA?.totalOutQuantity, 15);
    assert.equal(totalProductA?.movementCount, 4);
    assert.equal(clinicAProductA?.totalOutQuantity, 11);
    assert.equal(clinicAProductA?.movementCount, 3);
    assert.equal(totalProductB?.totalOutQuantity, 1);
    assert.equal(rows.some((row) => row.clinicName === "Inactive Clinic"), false);
    assert.equal(rows.some((row) => row.clinicName === "Other Clinic"), false);

    const csv = buildAdminUsageExportCsv({
      rows,
      dateRange,
    });

    assert.ok(csv.startsWith("\uFEFF"));
    assert.ok(csv.includes('"法人合計"'));
    assert.ok(csv.includes(`"'=Risk Product"`));
    assert.ok(csv.includes('"15"'));
    assert.throws(() =>
      parseAdminUsageExportDateRange({
        startDate: "2026-01-01",
        endDate: "2027-02-01",
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
