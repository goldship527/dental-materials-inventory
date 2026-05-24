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
  const { createStaffOperatorForContext, deactivateStaffOperatorForContext } = await import("../src/lib/actions/staff-operators");
  const { findActiveStaffOperatorForClinic } = await import("../src/lib/db/staff-operators");

  try {
    const data = await seedTestData(prisma);
    const staff = await createStaffOperatorForContext({
      adminUserId: data.admin.id,
      organizationId: data.organization.id,
      displayName: "Help Staff",
      barcode: "help-001",
      operatorType: "HELP",
      clinicIds: [data.clinic.id],
    });

    const created = await prisma.staffOperator.findUniqueOrThrow({
      where: {
        id: staff.id,
      },
      include: {
        clinicAssignments: true,
      },
    });

    assert.equal(created.barcode, "HELP-001");
    assert.equal(created.operatorType, "HELP");
    assert.equal(created.clinicAssignments.length, 1);
    assert.equal(created.clinicAssignments[0].clinicId, data.clinic.id);

    const resolved = await findActiveStaffOperatorForClinic({
      organizationId: data.organization.id,
      clinicId: data.clinic.id,
      barcode: "help-001",
    });

    assert.equal(resolved?.id, staff.id);

    const otherClinicResolved = await findActiveStaffOperatorForClinic({
      organizationId: data.organization.id,
      clinicId: data.otherClinic.id,
      barcode: "HELP-001",
    });

    assert.equal(otherClinicResolved, null);

    await assert.rejects(() =>
      createStaffOperatorForContext({
        adminUserId: data.admin.id,
        organizationId: data.organization.id,
        displayName: "Duplicate Help",
        barcode: "HELP-001",
        operatorType: "HELP",
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
      barcode: "HELP-001",
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
