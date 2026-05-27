import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const {
    buildRecommendedMinStockSummary,
    calculateRecommendedMinStock,
    getRecommendedMinStocks,
  } = await import("../src/lib/stock/recommended-min-stock");

  try {
    const today = new Date("2026-05-27T00:00:00.000Z");
    const organization = await prisma.organization.create({
      data: {
        name: "Recommended Min Stock Test Organization",
      },
    });
    const otherOrganization = await prisma.organization.create({
      data: {
        name: "Other Recommended Min Stock Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Recommended Min Stock Test Clinic",
      },
    });
    const otherClinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Other Recommended Min Stock Test Clinic",
      },
    });
    const otherOrganizationClinic = await prisma.clinic.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Organization Recommended Min Stock Test Clinic",
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Recommended Min Stock Test User",
        email: "recommended-min-stock@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const otherUser = await prisma.user.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Recommended Min Stock Test User",
        email: "other-recommended-min-stock@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const supplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: "Recommended Lead Supplier",
      },
    });
    const fallbackSupplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: "Recommended Fallback Supplier",
      },
    });
    const product = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Recommended Product",
        defaultMinStock: 1,
        primarySupplierId: supplier.id,
      },
    });
    const fallbackProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Recommended Fallback Product",
        defaultMinStock: 1,
        primarySupplierId: fallbackSupplier.id,
      },
    });
    const noUsageProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Recommended No Usage Product",
        defaultMinStock: 1,
      },
    });
    const otherOrganizationProduct = await prisma.product.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Organization Recommended Product",
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
          receivedAt: new Date("2026-05-11T00:00:00.000Z"),
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: product.id,
          supplierId: supplier.id,
          requestedQuantity: 1,
          status: "ORDERED",
          orderedAt: new Date("2026-05-03T00:00:00.000Z"),
          receivedAt: new Date("2026-05-13T00:00:00.000Z"),
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: product.id,
          supplierId: supplier.id,
          requestedQuantity: 1,
          status: "ORDERED",
          orderedAt: new Date("2026-05-05T00:00:00.000Z"),
          receivedAt: new Date("2026-05-15T00:00:00.000Z"),
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: fallbackProduct.id,
          supplierId: fallbackSupplier.id,
          requestedQuantity: 1,
          status: "ORDERED",
          orderedAt: new Date("2026-05-05T00:00:00.000Z"),
          receivedAt: new Date("2026-05-08T00:00:00.000Z"),
          createdByUserId: user.id,
        },
      ],
    });

    await prisma.stockMovement.createMany({
      data: [
        {
          clinicId: clinic.id,
          productId: product.id,
          movementType: "OUT",
          quantity: 90,
          beforeQuantity: 100,
          afterQuantity: 10,
          userId: user.id,
          createdAt: new Date("2026-05-20T00:00:00.000Z"),
        },
        {
          clinicId: clinic.id,
          productId: fallbackProduct.id,
          movementType: "OUT",
          quantity: 30,
          beforeQuantity: 50,
          afterQuantity: 20,
          userId: user.id,
          createdAt: new Date("2026-05-20T00:00:00.000Z"),
        },
        {
          clinicId: clinic.id,
          productId: product.id,
          movementType: "IN",
          quantity: 99,
          beforeQuantity: 10,
          afterQuantity: 109,
          userId: user.id,
          createdAt: new Date("2026-05-21T00:00:00.000Z"),
        },
        {
          clinicId: clinic.id,
          productId: product.id,
          movementType: "OUT",
          quantity: 99,
          beforeQuantity: 109,
          afterQuantity: 10,
          userId: user.id,
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
        },
        {
          clinicId: otherClinic.id,
          productId: product.id,
          movementType: "OUT",
          quantity: 99,
          beforeQuantity: 99,
          afterQuantity: 0,
          userId: user.id,
          createdAt: new Date("2026-05-22T00:00:00.000Z"),
        },
        {
          clinicId: otherOrganizationClinic.id,
          productId: otherOrganizationProduct.id,
          movementType: "OUT",
          quantity: 99,
          beforeQuantity: 99,
          afterQuantity: 0,
          userId: otherUser.id,
          createdAt: new Date("2026-05-22T00:00:00.000Z"),
        },
      ],
    });

    const recommendations = await getRecommendedMinStocks(organization.id, clinic.id, { today });

    assert.deepEqual(recommendations[product.id], {
      recommended: 15,
      totalOut90d: 90,
      monthlyUsage: 30,
      leadDays: 10,
      safetyFactor: 1.5,
      sampleSufficient: true,
      usesFallbackLeadTime: false,
      leadTimeSampleCount: 3,
    });
    assert.deepEqual(recommendations[fallbackProduct.id], {
      recommended: 4,
      totalOut90d: 30,
      monthlyUsage: 10,
      leadDays: 7,
      safetyFactor: 1.5,
      sampleSufficient: true,
      usesFallbackLeadTime: true,
      leadTimeSampleCount: 1,
    });
    assert.deepEqual(recommendations[noUsageProduct.id], {
      recommended: null,
      totalOut90d: 0,
      monthlyUsage: 0,
      leadDays: 7,
      safetyFactor: 1.5,
      sampleSufficient: false,
      usesFallbackLeadTime: true,
      leadTimeSampleCount: null,
    });
    assert.equal(recommendations[otherOrganizationProduct.id], undefined);

    assert.equal(calculateRecommendedMinStock({ totalOut90d: 90, leadDays: 10, safetyFactor: 1.5 }), 15);
    assert.equal(calculateRecommendedMinStock({ totalOut90d: 0, leadDays: 10, safetyFactor: 1.5 }), null);
    assert.deepEqual(buildRecommendedMinStockSummary({ totalOut90d: 45, leadDays: 7 }), {
      recommended: 6,
      totalOut90d: 45,
      monthlyUsage: 15,
      leadDays: 7,
      safetyFactor: 1.5,
      sampleSufficient: true,
      usesFallbackLeadTime: false,
      leadTimeSampleCount: null,
    });
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
