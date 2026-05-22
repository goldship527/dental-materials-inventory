import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { updateOrderRequestSupplierForContext } = await import("../src/lib/actions/orders");
  const { getOrderRequestRows } = await import("../src/lib/db/orders");

  try {
    const organization = await prisma.organization.create({
      data: {
        name: "Order Supplier Test Organization",
      },
    });
    const otherOrganization = await prisma.organization.create({
      data: {
        name: "Other Order Supplier Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Order Supplier Test Clinic",
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Order Supplier User",
        email: "order-supplier-user@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const primarySupplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: "Primary Order Supplier",
      },
    });
    const alternativeSupplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: "Alternative Order Supplier",
      },
    });
    const unrelatedSupplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: "Unrelated Order Supplier",
      },
    });
    const otherOrganizationSupplier = await prisma.supplier.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Organization Supplier",
      },
    });
    const product = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Order Supplier Product",
        productCode: "ORDER-SUPPLIER-001",
        primarySupplierId: primarySupplier.id,
        supplierProductCode: "PRIMARY-CODE",
        orderUnit: "box",
        standardPrice: 1200,
        defaultMinStock: 3,
      },
    });

    await prisma.userClinicAssignment.create({
      data: {
        userId: user.id,
        clinicId: clinic.id,
      },
    });
    await prisma.productSupplier.createMany({
      data: [
        {
          organizationId: organization.id,
          productId: product.id,
          supplierId: primarySupplier.id,
          supplierProductCode: "PRIMARY-CODE",
          orderUnit: "box",
          standardPrice: 1200,
          isPrimary: true,
        },
        {
          organizationId: organization.id,
          productId: product.id,
          supplierId: alternativeSupplier.id,
          supplierProductCode: "ALT-CODE",
          orderUnit: "pack",
          standardPrice: 1300,
          isPrimary: false,
        },
      ],
    });
    const request = await prisma.orderRequest.create({
      data: {
        clinicId: clinic.id,
        productId: product.id,
        supplierId: primarySupplier.id,
        requestedQuantity: 3,
        status: "DRAFT",
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

    const firstRows = await getOrderRequestRows(clinic.id);

    assert.equal(firstRows.length, 1);
    assert.equal(firstRows[0]?.supplierOptions.length, 2);
    assert.equal(firstRows[0]?.supplierProductCode, "PRIMARY-CODE");

    const result = await updateOrderRequestSupplierForContext(context, {
      orderRequestId: request.id,
      supplierId: alternativeSupplier.id,
      revalidate: false,
    });

    assert.equal(result.supplierName, "Alternative Order Supplier");

    const updatedRequest = await prisma.orderRequest.findUniqueOrThrow({
      where: {
        id: request.id,
      },
    });

    assert.equal(updatedRequest.supplierId, alternativeSupplier.id);

    const updatedRows = await getOrderRequestRows(clinic.id);

    assert.equal(updatedRows[0]?.supplierId, alternativeSupplier.id);
    assert.equal(updatedRows[0]?.supplierProductCode, "ALT-CODE");
    assert.equal(updatedRows[0]?.orderUnit, "pack");
    assert.equal(updatedRows[0]?.standardPrice, 1300);

    await assert.rejects(() =>
      updateOrderRequestSupplierForContext(context, {
        orderRequestId: request.id,
        supplierId: unrelatedSupplier.id,
        revalidate: false,
      }),
    );
    await assert.rejects(() =>
      updateOrderRequestSupplierForContext(context, {
        orderRequestId: request.id,
        supplierId: otherOrganizationSupplier.id,
        revalidate: false,
      }),
    );

    await prisma.orderRequest.update({
      where: {
        id: request.id,
      },
      data: {
        status: "ORDERED",
      },
    });

    await assert.rejects(() =>
      updateOrderRequestSupplierForContext(context, {
        orderRequestId: request.id,
        supplierId: primarySupplier.id,
        revalidate: false,
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
