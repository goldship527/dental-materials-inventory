import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { markOrderRequestsOrderedForContext, updateOrderRequestStatusForContext } = await import(
    "../src/lib/actions/orders"
  );

  try {
    const organization = await prisma.organization.create({
      data: {
        name: "Order Status Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Order Status Test Clinic",
      },
    });
    const otherClinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Other Order Status Test Clinic",
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Order Status User",
        email: "order-status-user@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const product = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Order Status Product",
        productCode: "ORDER-STATUS-001",
        defaultMinStock: 3,
      },
    });

    await prisma.userClinicAssignment.create({
      data: {
        userId: user.id,
        clinicId: clinic.id,
      },
    });
    await prisma.userClinicAssignment.create({
      data: {
        userId: user.id,
        clinicId: otherClinic.id,
      },
    });

    const request = await prisma.orderRequest.create({
      data: {
        clinicId: clinic.id,
        productId: product.id,
        requestedQuantity: 3,
        status: "ORDERED",
        memo: "Sent by phone",
        orderedMethod: "PHONE",
        orderedMemo: "Called supplier desk",
        supplierResponseMemo: "Accepted by supplier",
        createdByUserId: user.id,
      },
    });
    const context = {
      userId: user.id,
      userName: user.name,
      organizationId: organization.id,
      clinicId: clinic.id,
      clinicName: clinic.name,
    };
    const otherClinicContext = {
      ...context,
      clinicId: otherClinic.id,
      clinicName: otherClinic.name,
    };

    await updateOrderRequestStatusForContext(context, {
      orderRequestId: request.id,
      status: "CONFIRMED",
      memo: "Mistaken ordered mark reverted",
      revalidate: false,
    });

    const confirmedRequest = await prisma.orderRequest.findUniqueOrThrow({
      where: {
        id: request.id,
      },
    });

    assert.equal(confirmedRequest.status, "CONFIRMED");
    assert.equal(confirmedRequest.memo, "Mistaken ordered mark reverted");
    assert.equal(confirmedRequest.orderedMethod, null);
    assert.equal(confirmedRequest.orderedMemo, null);
    assert.equal(confirmedRequest.supplierResponseMemo, null);

    await updateOrderRequestStatusForContext(context, {
      orderRequestId: request.id,
      status: "DRAFT",
      memo: null,
      revalidate: false,
    });

    const draftRequest = await prisma.orderRequest.findUniqueOrThrow({
      where: {
        id: request.id,
      },
    });

    assert.equal(draftRequest.status, "DRAFT");
    assert.equal(draftRequest.memo, null);
    assert.equal(draftRequest.orderedAt, null);

    await updateOrderRequestStatusForContext(context, {
      orderRequestId: request.id,
      status: "ORDERED",
      memo: "Sent by fax",
      orderedMethod: "FAX",
      orderedMemo: "Faxed order draft",
      supplierResponseMemo: "No response yet",
      revalidate: false,
    });

    const orderedRequest = await prisma.orderRequest.findUniqueOrThrow({
      where: {
        id: request.id,
      },
    });

    assert.equal(orderedRequest.status, "ORDERED");
    assert.notEqual(orderedRequest.orderedAt, null);
    assert.equal(orderedRequest.orderedMethod, "FAX");
    assert.equal(orderedRequest.orderedMemo, "Faxed order draft");
    assert.equal(orderedRequest.supplierResponseMemo, "No response yet");
    assert.notEqual(orderedRequest.orderRecordId, null);

    const orderRecord = await prisma.orderRecord.findUniqueOrThrow({
      where: {
        id: orderedRequest.orderRecordId ?? "",
      },
    });

    assert.equal(orderRecord.clinicId, clinic.id);
    assert.equal(orderRecord.supplierId, null);
    assert.equal(orderRecord.orderedMethod, "FAX");
    assert.equal(orderRecord.orderedMemo, "Faxed order draft");
    assert.equal(orderRecord.supplierResponseMemo, "No response yet");

    await updateOrderRequestStatusForContext(context, {
      orderRequestId: request.id,
      status: "DRAFT",
      memo: null,
      revalidate: false,
    });

    await assert.rejects(() =>
      updateOrderRequestStatusForContext(otherClinicContext, {
        orderRequestId: request.id,
        status: "SKIPPED",
        memo: "Wrong clinic update",
        revalidate: false,
      }),
    );

    const unchangedRequest = await prisma.orderRequest.findUniqueOrThrow({
      where: {
        id: request.id,
      },
    });

    assert.equal(unchangedRequest.status, "DRAFT");
    assert.equal(unchangedRequest.memo, null);
    assert.equal(unchangedRequest.orderedAt, null);
    assert.equal(unchangedRequest.orderedMethod, null);
    assert.equal(unchangedRequest.orderedMemo, null);
    assert.equal(unchangedRequest.supplierResponseMemo, null);
    assert.equal(unchangedRequest.orderRecordId, null);
    assert.equal(
      await prisma.orderRecord.findUnique({
        where: {
          id: orderRecord.id,
        },
      }),
      null,
    );

    const supplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: "Order Status Supplier",
      },
    });
    const groupRequestA = await prisma.orderRequest.create({
      data: {
        clinicId: clinic.id,
        productId: product.id,
        supplierId: supplier.id,
        requestedQuantity: 2,
        status: "CONFIRMED",
        createdByUserId: user.id,
      },
    });
    const groupRequestB = await prisma.orderRequest.create({
      data: {
        clinicId: clinic.id,
        productId: product.id,
        supplierId: supplier.id,
        requestedQuantity: 4,
        status: "DRAFT",
        createdByUserId: user.id,
      },
    });

    await markOrderRequestsOrderedForContext(context, {
      orderRequestIds: [groupRequestA.id, groupRequestB.id],
      orderedMethod: "LINE",
      orderedMemo: "Sent as one order",
      supplierResponseMemo: "Read receipt confirmed",
      revalidate: false,
    });

    const groupedRequests = await prisma.orderRequest.findMany({
      where: {
        id: {
          in: [groupRequestA.id, groupRequestB.id],
        },
      },
      orderBy: {
        id: "asc",
      },
    });

    assert.equal(groupedRequests.length, 2);
    assert.equal(groupedRequests[0]?.status, "ORDERED");
    assert.equal(groupedRequests[1]?.status, "ORDERED");
    assert.notEqual(groupedRequests[0]?.orderRecordId, null);
    assert.equal(groupedRequests[0]?.orderRecordId, groupedRequests[1]?.orderRecordId);

    const groupedOrderRecord = await prisma.orderRecord.findUniqueOrThrow({
      where: {
        id: groupedRequests[0]?.orderRecordId ?? "",
      },
    });

    assert.equal(groupedOrderRecord.supplierId, supplier.id);
    assert.equal(groupedOrderRecord.orderedMethod, "LINE");
    assert.equal(groupedOrderRecord.orderedMemo, "Sent as one order");
    assert.equal(groupedOrderRecord.supplierResponseMemo, "Read receipt confirmed");

    const concurrentRequestA = await prisma.orderRequest.create({
      data: {
        clinicId: clinic.id,
        productId: product.id,
        supplierId: supplier.id,
        requestedQuantity: 1,
        status: "CONFIRMED",
        createdByUserId: user.id,
      },
    });
    const concurrentRequestB = await prisma.orderRequest.create({
      data: {
        clinicId: clinic.id,
        productId: product.id,
        supplierId: supplier.id,
        requestedQuantity: 1,
        status: "CONFIRMED",
        createdByUserId: user.id,
      },
    });

    const concurrentOrderedResults = await Promise.allSettled([
      markOrderRequestsOrderedForContext(context, {
        orderRequestIds: [concurrentRequestA.id, concurrentRequestB.id],
        orderedMethod: "PHONE",
        orderedMemo: "Concurrent ordered A",
        supplierResponseMemo: null,
        revalidate: false,
      }),
      markOrderRequestsOrderedForContext(context, {
        orderRequestIds: [concurrentRequestA.id, concurrentRequestB.id],
        orderedMethod: "PHONE",
        orderedMemo: "Concurrent ordered B",
        supplierResponseMemo: null,
        revalidate: false,
      }),
    ]);

    assert.equal(concurrentOrderedResults.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(concurrentOrderedResults.filter((result) => result.status === "rejected").length, 1);

    const concurrentOrderedRequests = await prisma.orderRequest.findMany({
      where: {
        id: {
          in: [concurrentRequestA.id, concurrentRequestB.id],
        },
      },
    });
    const concurrentOrderRecordIds = new Set(concurrentOrderedRequests.map((row) => row.orderRecordId));

    assert.equal(concurrentOrderedRequests.length, 2);
    assert.ok(concurrentOrderedRequests.every((row) => row.status === "ORDERED"));
    assert.equal(concurrentOrderRecordIds.size, 1);
    assert.equal(
      await prisma.orderRecord.count({
        where: {
          id: {
            in: Array.from(concurrentOrderRecordIds).filter((id): id is string => id !== null),
          },
        },
      }),
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
