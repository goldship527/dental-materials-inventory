import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { syncProductSuppliersForContext } = await import("../src/lib/actions/products");

  try {
    const organization = await prisma.organization.create({
      data: {
        name: "Product Suppliers Test Organization",
      },
    });
    const product = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Product Suppliers Test Product",
        defaultMinStock: 1,
      },
    });
    const primarySupplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: "Primary Supplier",
      },
    });
    const alternativeSupplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: "Alternative Supplier",
      },
    });
    const nextPrimarySupplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: "Next Primary Supplier",
      },
    });

    await prisma.$transaction((tx) =>
      syncProductSuppliersForContext(tx, {
        organizationId: organization.id,
        productId: product.id,
        primarySupplierId: primarySupplier.id,
        primarySupplierProductCode: "P-001",
        primaryOrderUnit: "box",
        primaryStandardPrice: 1200,
        alternatives: [
          {
            supplierId: alternativeSupplier.id,
            supplierProductCode: "A-001",
            orderUnit: "pack",
            standardPrice: 1300,
            isPrimary: false,
            notes: "backup",
          },
        ],
      }),
    );

    const firstRows = await prisma.productSupplier.findMany({
      where: {
        productId: product.id,
      },
      orderBy: {
        supplierId: "asc",
      },
    });

    assert.equal(firstRows.length, 2);
    assert.equal(firstRows.filter((row) => row.isPrimary).length, 1);
    assert.equal(firstRows.find((row) => row.isPrimary)?.supplierId, primarySupplier.id);
    assert.equal(firstRows.find((row) => row.supplierId === alternativeSupplier.id)?.notes, "backup");

    await prisma.$transaction((tx) =>
      syncProductSuppliersForContext(tx, {
        organizationId: organization.id,
        productId: product.id,
        primarySupplierId: nextPrimarySupplier.id,
        primarySupplierProductCode: "NP-001",
        primaryOrderUnit: "case",
        primaryStandardPrice: 1100,
        alternatives: [
          {
            supplierId: primarySupplier.id,
            supplierProductCode: "P-ALT",
            orderUnit: "box",
            standardPrice: 1250,
            isPrimary: false,
            notes: null,
          },
        ],
      }),
    );

    const updatedRows = await prisma.productSupplier.findMany({
      where: {
        productId: product.id,
      },
      orderBy: {
        isPrimary: "desc",
      },
    });

    assert.equal(updatedRows.length, 2);
    assert.equal(updatedRows.filter((row) => row.isPrimary).length, 1);
    assert.equal(updatedRows[0]?.supplierId, nextPrimarySupplier.id);
    assert.equal(updatedRows[0]?.supplierProductCode, "NP-001");
    assert.equal(updatedRows[1]?.supplierId, primarySupplier.id);

    await assert.rejects(() =>
      prisma.$transaction((tx) =>
        syncProductSuppliersForContext(tx, {
          organizationId: organization.id,
          productId: product.id,
          primarySupplierId: nextPrimarySupplier.id,
          primarySupplierProductCode: null,
          primaryOrderUnit: null,
          primaryStandardPrice: null,
          alternatives: [
            {
              supplierId: nextPrimarySupplier.id,
              supplierProductCode: null,
              orderUnit: null,
              standardPrice: null,
              isPrimary: false,
              notes: null,
            },
          ],
        }),
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
