import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { calculateLeadDays, calculateLeadTimeStats, getSupplierLeadTimes } = await import(
    "../src/lib/db/supplier-lead-times"
  );

  try {
    const today = new Date("2026-05-27T00:00:00.000Z");
    const organization = await prisma.organization.create({
      data: {
        name: "Supplier Lead Times Test Organization",
      },
    });
    const otherOrganization = await prisma.organization.create({
      data: {
        name: "Other Supplier Lead Times Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Supplier Lead Times Test Clinic",
      },
    });
    const otherOrganizationClinic = await prisma.clinic.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Supplier Lead Times Test Clinic",
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Supplier Lead Times Test User",
        email: "supplier-lead-times@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const otherUser = await prisma.user.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Supplier Lead Times Test User",
        email: "other-supplier-lead-times@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const supplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: "Lead Times Supplier",
      },
    });
    const insufficientSupplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: "Insufficient Lead Times Supplier",
      },
    });
    const otherSupplier = await prisma.supplier.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Lead Times Supplier",
      },
    });
    const product = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Lead Times Product",
        defaultMinStock: 1,
      },
    });
    const otherProduct = await prisma.product.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Lead Times Product",
        defaultMinStock: 1,
      },
    });

    await prisma.orderRequest.createMany({
      data: [
        {
          clinicId: clinic.id,
          productId: product.id,
          supplierId: supplier.id,
          requestedQuantity: 1,
          status: "ORDERED",
          orderedAt: new Date("2026-05-01T00:00:00.000Z"),
          receivedAt: new Date("2026-05-03T00:00:00.000Z"),
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: product.id,
          supplierId: supplier.id,
          requestedQuantity: 1,
          status: "ORDERED",
          orderedAt: new Date("2026-05-05T00:00:00.000Z"),
          receivedAt: new Date("2026-05-09T00:00:00.000Z"),
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: product.id,
          supplierId: supplier.id,
          requestedQuantity: 1,
          status: "ORDERED",
          orderedAt: new Date("2026-05-10T00:00:00.000Z"),
          receivedAt: new Date("2026-05-19T00:00:00.000Z"),
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: product.id,
          supplierId: supplier.id,
          requestedQuantity: 1,
          status: "ORDERED",
          orderedAt: new Date("2025-10-01T00:00:00.000Z"),
          receivedAt: new Date("2025-11-01T00:00:00.000Z"),
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: product.id,
          supplierId: supplier.id,
          requestedQuantity: 1,
          status: "ORDERED",
          orderedAt: new Date("2026-05-20T00:00:00.000Z"),
          receivedAt: null,
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: product.id,
          supplierId: supplier.id,
          requestedQuantity: 1,
          status: "CONFIRMED",
          orderedAt: new Date("2026-05-20T00:00:00.000Z"),
          receivedAt: new Date("2026-05-21T00:00:00.000Z"),
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: product.id,
          supplierId: null,
          requestedQuantity: 1,
          status: "ORDERED",
          orderedAt: new Date("2026-05-20T00:00:00.000Z"),
          receivedAt: new Date("2026-05-21T00:00:00.000Z"),
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: product.id,
          supplierId: insufficientSupplier.id,
          requestedQuantity: 1,
          status: "ORDERED",
          orderedAt: new Date("2026-05-01T00:00:00.000Z"),
          receivedAt: new Date("2026-05-03T00:00:00.000Z"),
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: product.id,
          supplierId: insufficientSupplier.id,
          requestedQuantity: 1,
          status: "ORDERED",
          orderedAt: new Date("2026-05-04T00:00:00.000Z"),
          receivedAt: new Date("2026-05-07T00:00:00.000Z"),
          createdByUserId: user.id,
        },
        {
          clinicId: otherOrganizationClinic.id,
          productId: otherProduct.id,
          supplierId: otherSupplier.id,
          requestedQuantity: 1,
          status: "ORDERED",
          orderedAt: new Date("2026-05-01T00:00:00.000Z"),
          receivedAt: new Date("2026-05-21T00:00:00.000Z"),
          createdByUserId: otherUser.id,
        },
      ],
    });

    const leadTimes = await getSupplierLeadTimes(organization.id, { today });

    assert.deepEqual(leadTimes[supplier.id], {
      avgDays: 5,
      medianDays: 4,
      sampleCount: 3,
      isSampleSufficient: true,
    });
    assert.deepEqual(leadTimes[insufficientSupplier.id], {
      avgDays: 2.5,
      medianDays: 2.5,
      sampleCount: 2,
      isSampleSufficient: false,
    });
    assert.equal(leadTimes[otherSupplier.id], undefined);

    assert.deepEqual(calculateLeadTimeStats([2, 9, 4]), {
      avgDays: 5,
      medianDays: 4,
      sampleCount: 3,
      isSampleSufficient: true,
    });
    assert.equal(calculateLeadTimeStats([]), null);
    assert.equal(
      calculateLeadDays(new Date("2026-05-01T12:00:00.000Z"), new Date("2026-05-02T11:00:00.000Z")),
      1,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
