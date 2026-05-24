import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { resetTestDatabase } from "./helpers/db";

function buildCsv(rows: string[][]) {
  return [
    "name,address,phone,fax,email,contactPersonName,contactPersonEmail,notes",
    ...rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
}

async function seedBase(prisma: typeof import("../src/lib/db/prisma").prisma) {
  const organization = await prisma.organization.create({
    data: {
      name: "Supplier Import Test Organization",
    },
  });
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Supplier Import User",
      email: "supplier-import-user@example.test",
      passwordHash: await bcrypt.hash("SupplierImport123!", 12),
      role: "ADMIN",
      isActive: true,
    },
  });

  await prisma.supplier.create({
    data: {
      organizationId: organization.id,
      name: "Existing Supplier",
    },
  });

  return {
    organization,
    user,
  };
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { auditActions } = await import("../src/lib/audit/audit-log");
  const { importSuppliersForContext, previewSupplierImportForContext } = await import(
    "../src/lib/actions/supplier-import"
  );

  try {
    const data = await seedBase(prisma);
    const normalCsv = buildCsv([
      [
        "Imported Supplier A",
        "Sample Address A",
        "03-0000-0001",
        "03-0000-0002",
        "orders-a@example.test",
        "Sample Contact A",
        "contact-a@example.test",
        "supplier import test",
      ],
      [
        "Imported Supplier B",
        "Sample Address B",
        "06-0000-0001",
        "06-0000-0002",
        "orders-b@example.test",
        "Sample Contact B",
        "contact-b@example.test",
        "supplier import test",
      ],
    ]);
    const normalPreview = await previewSupplierImportForContext({
      organizationId: data.organization.id,
      sourceText: normalCsv,
      sourceType: "CSV",
    });

    assert.equal(normalPreview.summary.totalRows, 2);
    assert.equal(normalPreview.summary.createdRows, 2);
    assert.equal(normalPreview.summary.errorRows, 0);

    const importResult = await importSuppliersForContext({
      organizationId: data.organization.id,
      userId: data.user.id,
      sourceText: normalCsv,
      sourceType: "CSV",
      fileName: "suppliers.csv",
    });
    const importedSuppliers = await prisma.supplier.findMany({
      where: {
        organizationId: data.organization.id,
        name: {
          startsWith: "Imported Supplier",
        },
      },
      orderBy: {
        name: "asc",
      },
    });
    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        organizationId: data.organization.id,
        action: auditActions.supplierImport,
      },
    });

    assert.equal(importResult.createdRows, 2);
    assert.equal(importedSuppliers.length, 2);
    assert.equal(importedSuppliers[0]?.email, "orders-a@example.test");
    assert.equal(importedSuppliers[0]?.contactPersonName, "Sample Contact A");
    assert.equal(auditLog.targetType, "Supplier");

    const duplicatePreview = await previewSupplierImportForContext({
      organizationId: data.organization.id,
      sourceText: buildCsv([
        ["Existing Supplier", "", "", "", "", "", "", ""],
        ["Duplicate In File", "", "", "", "", "", "", ""],
        ["Duplicate In File", "", "", "", "", "", "", ""],
      ]),
      sourceType: "CSV",
    });

    assert.equal(duplicatePreview.summary.totalRows, 3);
    assert.equal(duplicatePreview.summary.createdRows, 1);
    assert.equal(duplicatePreview.summary.skippedRows, 2);
    assert.equal(duplicatePreview.summary.warningRows, 2);
    assert.match(duplicatePreview.rows[0]?.warnings.join(" "), /既にあります/);
    assert.match(duplicatePreview.rows[2]?.warnings.join(" "), /同じファイル内/);

    const invalidPreview = await previewSupplierImportForContext({
      organizationId: data.organization.id,
      sourceText: buildCsv([["Invalid Supplier", "", "", "", "not-email", "", "", ""]]),
      sourceType: "CSV",
    });

    assert.equal(invalidPreview.summary.errorRows, 1);
    await assert.rejects(() =>
      importSuppliersForContext({
        organizationId: data.organization.id,
        userId: data.user.id,
        sourceText: buildCsv([["Invalid Supplier", "", "", "", "not-email", "", "", ""]]),
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
