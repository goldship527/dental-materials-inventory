import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { resetTestDatabase } from "./helpers/db";

async function seedTestData(prisma: PrismaClient) {
  const organization = await prisma.organization.create({
    data: {
      name: "Staff Operator Organization",
    },
  });
  const clinic = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Main Clinic",
    },
  });
  const otherClinic = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Branch Clinic",
    },
  });
  const admin = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Admin User",
      email: "staff-operator-admin@example.com",
      passwordHash: "test-password-hash",
      role: "ADMIN",
    },
  });

  return {
    organization,
    clinic,
    otherClinic,
    admin,
  };
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const {
    createStaffOperatorForContext,
    deactivateStaffOperatorForContext,
    updateStaffOperatorForContext,
  } = await import("../src/lib/actions/staff-operators");
  const { findActiveStaffOperatorForClinic } = await import("../src/lib/db/staff-operators");

  try {
    const data = await seedTestData(prisma);
    const staff = await createStaffOperatorForContext({
      adminUserId: data.admin.id,
      organizationId: data.organization.id,
      displayName: "Roaming Staff",
      barcode: "staff-001",
      clinicIds: [data.clinic.id, data.otherClinic.id],
    });

    const created = await prisma.staffOperator.findUniqueOrThrow({
      where: {
        id: staff.id,
      },
      include: {
        clinicAssignments: true,
      },
    });

    assert.equal(created.barcode, "STAFF-001");
    assert.equal(created.operatorType, "REGULAR");
    assert.equal(created.clinicAssignments.length, 2);
    assert.deepEqual(
      created.clinicAssignments.map((assignment) => assignment.clinicId).sort(),
      [data.clinic.id, data.otherClinic.id].sort(),
    );

    const resolved = await findActiveStaffOperatorForClinic({
      organizationId: data.organization.id,
      clinicId: data.clinic.id,
      barcode: "staff-001",
    });

    assert.equal(resolved?.id, staff.id);

    const otherClinicResolved = await findActiveStaffOperatorForClinic({
      organizationId: data.organization.id,
      clinicId: data.otherClinic.id,
      barcode: "STAFF-001",
    });

    assert.equal(otherClinicResolved?.id, staff.id);

    await updateStaffOperatorForContext({
      adminUserId: data.admin.id,
      organizationId: data.organization.id,
      staffOperatorId: staff.id,
      displayName: "Edited Staff",
      barcode: "staff-002",
      clinicIds: [data.clinic.id],
    });

    const updated = await prisma.staffOperator.findUniqueOrThrow({
      where: {
        id: staff.id,
      },
      include: {
        clinicAssignments: true,
      },
    });

    assert.equal(updated.displayName, "Edited Staff");
    assert.equal(updated.barcode, "STAFF-002");
    assert.equal(updated.clinicAssignments.length, 1);
    assert.equal(updated.clinicAssignments[0].clinicId, data.clinic.id);

    const oldBarcodeResolved = await findActiveStaffOperatorForClinic({
      organizationId: data.organization.id,
      clinicId: data.clinic.id,
      barcode: "STAFF-001",
    });

    assert.equal(oldBarcodeResolved, null);

    const removedClinicResolved = await findActiveStaffOperatorForClinic({
      organizationId: data.organization.id,
      clinicId: data.otherClinic.id,
      barcode: "STAFF-002",
    });

    assert.equal(removedClinicResolved, null);

    await assert.rejects(() =>
      createStaffOperatorForContext({
        adminUserId: data.admin.id,
        organizationId: data.organization.id,
        displayName: "Duplicate Staff",
        barcode: "STAFF-002",
        clinicIds: [data.clinic.id],
      }),
    );

    await deactivateStaffOperatorForContext({
      adminUserId: data.admin.id,
      organizationId: data.organization.id,
      staffOperatorId: staff.id,
    });

    const inactiveResolved = await findActiveStaffOperatorForClinic({
      organizationId: data.organization.id,
      clinicId: data.clinic.id,
      barcode: "STAFF-002",
    });

    assert.equal(inactiveResolved, null);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
