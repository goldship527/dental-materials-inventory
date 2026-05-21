import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { resetTestDatabase } from "./helpers/db";

function buildCsv(rows: string[][]) {
  return [
    "name,productCode,janCode,category,manufacturer,orderUnit,primarySupplierName,standardPrice,defaultMinStock,notes",
    ...rows.map((row) => row.join(",")),
  ].join("\n");
}

async function seedBase(prisma: typeof import("../src/lib/db/prisma").prisma) {
  const organization = await prisma.organization.create({
    data: {
      name: "Product Import Test Organization",
    },
  });
  const clinic = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Product Import Test Clinic",
      isActive: true,
    },
  });
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Product Import User",
      email: "product-import-user@example.test",
      passwordHash: await bcrypt.hash("ProductImport123!", 12),
      role: "ADMIN",
      isActive: true,
    },
  });
  const supplier = await prisma.supplier.create({
    data: {
      organizationId: organization.id,
      name: "Test Supplier",
    },
  });

  await prisma.userClinicAssignment.create({
    data: {
      userId: user.id,
      clinicId: clinic.id,
    },
  });
  await prisma.product.create({
    data: {
      organizationId: organization.id,
      name: "Existing Product",
      janCode: "4999999999999",
      defaultMinStock: 1,
    },
  });

  return {
    organization,
    user,
    supplier,
  };
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { importProductsForContext, previewProductImportForContext } = await import("../src/lib/actions/product-import");

  try {
    const data = await seedBase(prisma);
    const normalCsv = buildCsv(
      Array.from({ length: 10 }, (_, index) => {
        const number = String(index + 1).padStart(2, "0");

        return [
          `Imported Product ${number}`,
          `IMP-${number}`,
          `49000000010${number}`,
          "Consumables",
          "Sample Maker",
          "box",
          data.supplier.name,
          "1200",
          "2",
          "import test",
        ];
      }),
    );
    const normalPreview = await previewProductImportForContext({
      organizationId: data.organization.id,
      sourceText: normalCsv,
      sourceType: "CSV",
    });

    assert.equal(normalPreview.summary.totalRows, 10);
    assert.equal(normalPreview.summary.createdRows, 10);
    assert.equal(normalPreview.summary.errorRows, 0);

    const importResult = await importProductsForContext({
      organizationId: data.organization.id,
      userId: data.user.id,
      sourceText: normalCsv,
      sourceType: "CSV",
      fileName: "normal.csv",
    });
    const importedProducts = await prisma.product.findMany({
      where: {
        organizationId: data.organization.id,
        productCode: {
          startsWith: "IMP-",
        },
      },
      select: {
        id: true,
        primarySupplierId: true,
      },
    });
    const stockItems = await prisma.stockItem.findMany({
      where: {
        productId: {
          in: importedProducts.map((product) => product.id),
        },
      },
    });
    const history = await prisma.productImportHistory.findFirstOrThrow({
      where: {
        organizationId: data.organization.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    assert.equal(importResult.createdRows, 10);
    assert.equal(importedProducts.length, 10);
    assert.equal(importedProducts.every((product) => product.primarySupplierId === data.supplier.id), true);
    assert.equal(stockItems.length, 0);
    assert.equal(history.fileName, "normal.csv");
    assert.equal(history.createdRows, 10);
    assert.equal(history.totalRows, 10);

    const duplicatePreview = await previewProductImportForContext({
      organizationId: data.organization.id,
      sourceText: buildCsv([
        ["Duplicate Existing", "DUP-1", "4999999999999", "", "", "", "", "", "0", ""],
        ["Duplicate In File A", "DUP-2", "4900000001999", "", "", "", "", "", "0", ""],
        ["Duplicate In File B", "DUP-3", "4900000001999", "", "", "", "", "", "0", ""],
      ]),
      sourceType: "CSV",
    });

    assert.equal(duplicatePreview.summary.totalRows, 3);
    assert.equal(duplicatePreview.summary.createdRows, 1);
    assert.equal(duplicatePreview.summary.skippedRows, 2);
    assert.equal(duplicatePreview.summary.warningRows, 2);
    assert.match(duplicatePreview.rows[0]?.warnings.join(" "), /既にあります/);
    assert.match(duplicatePreview.rows[2]?.warnings.join(" "), /同じファイル内/);

    const invalidPreview = await previewProductImportForContext({
      organizationId: data.organization.id,
      sourceText: buildCsv([["", "BAD-1", "123", "", "", "", "", "", "-1", ""]]),
      sourceType: "CSV",
    });

    assert.equal(invalidPreview.summary.errorRows, 1);
    await assert.rejects(() =>
      importProductsForContext({
        organizationId: data.organization.id,
        userId: data.user.id,
        sourceText: buildCsv([["", "BAD-1", "123", "", "", "", "", "", "-1", ""]]),
        sourceType: "CSV",
        fileName: "invalid.csv",
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
