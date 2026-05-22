import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { updateOrderRequestStatusForContext } = await import("../src/lib/actions/orders");

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
      revalidate: false,
    });

    const orderedRequest = await prisma.orderRequest.findUniqueOrThrow({
      where: {
        id: request.id,
      },
    });

    assert.equal(orderedRequest.status, "ORDERED");
    assert.notEqual(orderedRequest.orderedAt, null);

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
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
