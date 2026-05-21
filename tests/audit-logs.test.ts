import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { resetTestDatabase } from "./helpers/db";

async function seedBase(prisma: typeof import("../src/lib/db/prisma").prisma) {
  const organization = await prisma.organization.create({
    data: {
      name: "Audit Log Test Organization",
    },
  });
  const clinic = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Audit Log Test Clinic",
      isActive: true,
    },
  });
  const admin = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Audit Admin",
      email: "audit-admin@example.test",
      passwordHash: await bcrypt.hash("AuditAdmin123!", 12),
      role: "ADMIN",
      isActive: true,
    },
  });
  const staff = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Audit Staff",
      email: "audit-staff@example.test",
      passwordHash: await bcrypt.hash("AuditStaff123!", 12),
      role: "STAFF",
      isActive: true,
    },
  });

  await prisma.userClinicAssignment.createMany({
    data: [
      {
        userId: admin.id,
        clinicId: clinic.id,
      },
      {
        userId: staff.id,
        clinicId: clinic.id,
      },
    ],
  });

  return {
    organization,
    admin,
    staff,
  };
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const {
    createUserAsAdminForContext,
    deactivateUserAsAdminForContext,
    resetUserPasswordAsAdminForContext,
  } = await import("../src/lib/actions/admin-users");
  const { auditActions } = await import("../src/lib/audit/audit-log");
  const { getRecentAuditLogs } = await import("../src/lib/db/audit-logs");

  try {
    const data = await seedBase(prisma);

    const createdUser = await createUserAsAdminForContext({
      adminUserId: data.admin.id,
      organizationId: data.organization.id,
      name: "Audit New Staff",
      email: "audit-new-staff@example.test",
      password: "AuditNewStaff123!",
      role: "STAFF",
    });

    await resetUserPasswordAsAdminForContext({
      adminUserId: data.admin.id,
      organizationId: data.organization.id,
      userId: data.staff.id,
      password: "AuditReset123!",
    });
    await deactivateUserAsAdminForContext({
      adminUserId: data.admin.id,
      organizationId: data.organization.id,
      userId: createdUser.id,
    });

    const logs = await getRecentAuditLogs(data.organization.id);

    assert.equal(logs.length, 3);
    assert.deepEqual(
      logs.map((log) => log.action).sort(),
      [
        auditActions.adminUserCreate,
        auditActions.adminUserDeactivate,
        auditActions.adminUserPasswordReset,
      ].sort(),
    );
    assert.equal(logs.every((log) => log.actorUserName === data.admin.name), true);
    assert.equal(logs.some((log) => log.targetId === createdUser.id), true);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
