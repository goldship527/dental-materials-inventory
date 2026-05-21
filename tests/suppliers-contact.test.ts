import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { auditActions } = await import("../src/lib/audit/audit-log");
  const { createSupplierForContext, updateSupplierForContext } = await import("../src/lib/actions/suppliers");
  const supplierAdminOnlyMessage = "発注先マスタの作成・編集は管理者のみ可能です。";

  try {
    const organization = await prisma.organization.create({
      data: {
        name: "Supplier Contact Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Supplier Contact Test Clinic",
        isActive: true,
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Supplier Contact User",
        email: "supplier-contact-user@example.test",
        passwordHash: await bcrypt.hash("SupplierContact123!", 12),
        role: "ADMIN",
        isActive: true,
      },
    });
    const staffUser = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Supplier Contact Staff",
        email: "supplier-contact-staff@example.test",
        passwordHash: await bcrypt.hash("SupplierContactStaff123!", 12),
        role: "STAFF",
        isActive: true,
      },
    });
    const context = {
      userId: user.id,
      userName: user.name,
      organizationId: organization.id,
      clinicId: clinic.id,
      clinicName: clinic.name,
    };
    const staffContext = {
      userId: staffUser.id,
      userName: staffUser.name,
      organizationId: organization.id,
      clinicId: clinic.id,
      clinicName: clinic.name,
    };

    const createdSupplier = await createSupplierForContext(context, {
      name: "Contact Supplier",
      address: "Sample Address",
      phone: "03-0000-0000",
      fax: "03-0000-0001",
      email: "orders@example.test",
      contactPersonName: "Sample Contact",
      contactPersonEmail: "contact@example.test",
      notes: "Contact note",
    });
    const storedCreatedSupplier = await prisma.supplier.findUniqueOrThrow({
      where: {
        id: createdSupplier.id,
      },
    });

    assert.equal(storedCreatedSupplier.organizationId, organization.id);
    assert.equal(storedCreatedSupplier.name, "Contact Supplier");
    assert.equal(storedCreatedSupplier.phone, "03-0000-0000");
    assert.equal(storedCreatedSupplier.email, "orders@example.test");
    assert.equal(storedCreatedSupplier.contactPersonName, "Sample Contact");

    await updateSupplierForContext(context, createdSupplier.id, {
      name: "Updated Supplier",
      address: "Updated Address",
      phone: "06-0000-0000",
      fax: null,
      email: null,
      contactPersonName: null,
      contactPersonEmail: "updated-contact@example.test",
      notes: null,
    });
    const storedUpdatedSupplier = await prisma.supplier.findUniqueOrThrow({
      where: {
        id: createdSupplier.id,
      },
    });
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId: organization.id,
        targetId: createdSupplier.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    assert.equal(storedUpdatedSupplier.name, "Updated Supplier");
    assert.equal(storedUpdatedSupplier.address, "Updated Address");
    assert.equal(storedUpdatedSupplier.phone, "06-0000-0000");
    assert.equal(storedUpdatedSupplier.fax, null);
    assert.equal(storedUpdatedSupplier.email, null);
    assert.equal(storedUpdatedSupplier.contactPersonEmail, "updated-contact@example.test");
    assert.deepEqual(
      auditLogs.map((log) => log.action),
      [auditActions.supplierCreate, auditActions.supplierUpdate],
    );

    await assert.rejects(
      () =>
        createSupplierForContext(staffContext, {
          name: "Staff Supplier",
          address: null,
          phone: null,
          fax: null,
          email: null,
          contactPersonName: null,
          contactPersonEmail: null,
          notes: null,
        }),
      {
        message: supplierAdminOnlyMessage,
      },
    );
    await assert.rejects(
      () =>
        updateSupplierForContext(staffContext, createdSupplier.id, {
          name: "Staff Updated Supplier",
          address: null,
          phone: null,
          fax: null,
          email: null,
          contactPersonName: null,
          contactPersonEmail: null,
          notes: null,
        }),
      {
        message: supplierAdminOnlyMessage,
      },
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
