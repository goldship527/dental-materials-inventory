import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { getOrderRecordListRows } = await import("../src/lib/db/order-records");

  try {
    const organization = await prisma.organization.create({
      data: {
        name: "Order Records Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Order Records Test Clinic",
      },
    });
    const otherClinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Other Order Records Test Clinic",
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Order Records User",
        email: "order-records-user@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const supplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: "Order Records Supplier",
      },
    });
    const productA = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Order Records Product A",
        productCode: "ORD-REC-A",
        defaultMinStock: 2,
      },
    });
    const productB = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Order Records Product B",
        productCode: "ORD-REC-B",
        defaultMinStock: 4,
      },
    });
    const orderedAt = new Date("2026-05-23T01:23:00.000Z");
    const record = await prisma.orderRecord.create({
      data: {
        clinicId: clinic.id,
        supplierId: supplier.id,
        orderedAt,
        orderedMethod: "EMAIL",
        orderedMemo: "Sent by email",
        supplierResponseMemo: "Supplier confirmed",
        createdByUserId: user.id,
      },
    });

    await prisma.orderRequest.create({
      data: {
        clinicId: clinic.id,
        productId: productA.id,
        supplierId: supplier.id,
        orderRecordId: record.id,
        requestedQuantity: 2,
        status: "ORDERED",
        orderedAt,
        orderedMethod: "EMAIL",
        orderedMemo: "Sent by email",
        supplierResponseMemo: "Supplier confirmed",
        receivedQuantity: 2,
        receivedAt: new Date("2026-05-24T01:23:00.000Z"),
        createdByUserId: user.id,
      },
    });
    await prisma.orderRequest.create({
      data: {
        clinicId: clinic.id,
        productId: productB.id,
        supplierId: supplier.id,
        orderRecordId: record.id,
        requestedQuantity: 3,
        status: "ORDERED",
        orderedAt,
        orderedMethod: "EMAIL",
        orderedMemo: "Sent by email",
        supplierResponseMemo: "Supplier confirmed",
        createdByUserId: user.id,
      },
    });
    await prisma.orderRecord.create({
      data: {
        clinicId: otherClinic.id,
        supplierId: supplier.id,
        orderedAt: new Date("2026-05-25T01:23:00.000Z"),
        orderedMethod: "FAX",
        createdByUserId: user.id,
      },
    });

    const rows = await getOrderRecordListRows(clinic.id);

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, record.id);
    assert.equal(rows[0]?.supplierId, supplier.id);
    assert.equal(rows[0]?.supplierName, supplier.name);
    assert.equal(rows[0]?.orderedMethod, "EMAIL");
    assert.equal(rows[0]?.orderedMemo, "Sent by email");
    assert.equal(rows[0]?.supplierResponseMemo, "Supplier confirmed");
    assert.equal(rows[0]?.createdByUserName, user.name);
    assert.equal(rows[0]?.requestCount, 2);
    assert.equal(rows[0]?.totalRequestedQuantity, 5);
    assert.equal(rows[0]?.receivedRequestCount, 1);
    assert.equal(rows[0]?.totalReceivedQuantity, 2);
    assert.deepEqual(
      rows[0]?.requests.map((request) => request.productCode),
      ["ORD-REC-A", "ORD-REC-B"],
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
