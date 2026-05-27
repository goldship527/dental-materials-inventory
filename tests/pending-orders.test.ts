import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { getPendingOrderDetailsByProduct, getPendingOrdersByProduct, summarizePendingOrderRows } = await import(
    "../src/lib/db/pending-orders"
  );

  try {
    const organization = await prisma.organization.create({
      data: {
        name: "Pending Orders Test Organization",
      },
    });
    const otherOrganization = await prisma.organization.create({
      data: {
        name: "Other Pending Orders Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Pending Orders Test Clinic",
      },
    });
    const otherClinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Other Pending Orders Test Clinic",
      },
    });
    const otherOrganizationClinic = await prisma.clinic.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Organization Pending Orders Test Clinic",
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Pending Orders Test User",
        email: "pending-orders@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const otherUser = await prisma.user.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Pending Orders Test User",
        email: "other-pending-orders@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const supplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: "Pending Orders Supplier",
      },
    });
    const productA = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Pending Product A",
        defaultMinStock: 1,
      },
    });
    const productB = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Pending Product B",
        defaultMinStock: 1,
      },
    });
    const otherOrganizationProduct = await prisma.product.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Organization Pending Product",
        defaultMinStock: 1,
      },
    });
    const firstOrderedAt = new Date("2026-05-01T09:00:00.000Z");
    const latestOrderedAt = new Date("2026-05-05T09:00:00.000Z");

    await prisma.orderRequest.createMany({
      data: [
        {
          clinicId: clinic.id,
          productId: productA.id,
          supplierId: supplier.id,
          requestedQuantity: 3,
          status: "ORDERED",
          orderedAt: firstOrderedAt,
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: productA.id,
          supplierId: supplier.id,
          requestedQuantity: 4,
          status: "ORDERED",
          orderedAt: latestOrderedAt,
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: productB.id,
          requestedQuantity: 2,
          status: "ORDERED",
          orderedAt: new Date("2026-05-03T09:00:00.000Z"),
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: productA.id,
          requestedQuantity: 99,
          status: "ORDERED",
          orderedAt: new Date("2026-05-06T09:00:00.000Z"),
          receivedAt: new Date("2026-05-07T09:00:00.000Z"),
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: productA.id,
          requestedQuantity: 99,
          status: "DRAFT",
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: productA.id,
          requestedQuantity: 99,
          status: "CONFIRMED",
          createdByUserId: user.id,
        },
        {
          clinicId: clinic.id,
          productId: productA.id,
          requestedQuantity: 99,
          status: "SKIPPED",
          createdByUserId: user.id,
        },
        {
          clinicId: otherClinic.id,
          productId: productA.id,
          requestedQuantity: 99,
          status: "ORDERED",
          orderedAt: new Date("2026-05-08T09:00:00.000Z"),
          createdByUserId: user.id,
        },
        {
          clinicId: otherOrganizationClinic.id,
          productId: otherOrganizationProduct.id,
          requestedQuantity: 99,
          status: "ORDERED",
          orderedAt: new Date("2026-05-09T09:00:00.000Z"),
          createdByUserId: otherUser.id,
        },
      ],
    });

    const summaries = await getPendingOrdersByProduct(organization.id, clinic.id);

    assert.deepEqual(summaries[productA.id], {
      count: 2,
      totalQuantity: 7,
      latestOrderedAt,
    });
    assert.deepEqual(summaries[productB.id], {
      count: 1,
      totalQuantity: 2,
      latestOrderedAt: new Date("2026-05-03T09:00:00.000Z"),
    });
    assert.equal(summaries[otherOrganizationProduct.id], undefined);

    const details = await getPendingOrderDetailsByProduct(organization.id, clinic.id);
    const productADetails = details[productA.id];

    assert.equal(productADetails?.count, 2);
    assert.equal(productADetails?.totalQuantity, 7);
    assert.equal(productADetails?.suppliers.length, 1);
    assert.equal(productADetails?.suppliers[0]?.supplierName, supplier.name);
    assert.equal(productADetails?.suppliers[0]?.totalQuantity, 7);

    const pureSummary = summarizePendingOrderRows([
      {
        productId: "pure-a",
        requestedQuantity: 1,
        orderedAt: firstOrderedAt,
      },
      {
        productId: "pure-a",
        requestedQuantity: 2,
        orderedAt: latestOrderedAt,
      },
    ]);

    assert.deepEqual(pureSummary["pure-a"], {
      count: 2,
      totalQuantity: 3,
      latestOrderedAt,
    });
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
