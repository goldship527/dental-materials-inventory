import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { resetTestDatabase } from "./helpers/db";

async function seedBase(prisma: typeof import("../src/lib/db/prisma").prisma) {
  const organization = await prisma.organization.create({
    data: {
      name: "Admin User Test Organization",
    },
  });
  const clinic = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Admin User Test Clinic",
      isActive: true,
    },
  });

  await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Inactive Clinic",
      isActive: false,
    },
  });

  const adminPassword = "AdminPass123!";
  const staffPassword = "StaffPass123!";
  const admin = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Admin User",
      email: "admin-users-admin@example.test",
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "ADMIN",
      isActive: true,
    },
  });
  const staff = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Staff User",
      email: "admin-users-staff@example.test",
      passwordHash: await bcrypt.hash(staffPassword, 12),
      role: "STAFF",
      isActive: true,
    },
  });
  const otherOrganization = await prisma.organization.create({
    data: {
      name: "Other Organization",
    },
  });
  const otherUser = await prisma.user.create({
    data: {
      organizationId: otherOrganization.id,
      name: "Other User",
      email: "admin-users-other@example.test",
      passwordHash: await bcrypt.hash("OtherPass123!", 12),
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
    clinic,
    admin,
    adminPassword,
    staff,
    staffPassword,
    otherUser,
  };
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { authorizeCredentials } = await import("../src/lib/auth/config");
  const { userRoles } = await import("../src/lib/auth/roles");
  const { inactiveAccountMessage, requireActiveClinic } = await import("../src/lib/db/clinic");
  const {
    createUserAsAdminForContext,
    deactivateUserAsAdminForContext,
    resetUserPasswordAsAdminForContext,
  } = await import("../src/lib/actions/admin-users");

  try {
    const data = await seedBase(prisma);
    const authorizedAdmin = await authorizeCredentials({
      email: data.admin.email,
      password: data.adminPassword,
    });

    assert.equal(authorizedAdmin?.id, data.admin.id);
    assert.equal(authorizedAdmin?.role, userRoles.admin);

    const activeClinicContext = await requireActiveClinic({
      sessionUser: {
        id: data.staff.id,
        name: data.staff.name,
        email: data.staff.email,
        organizationId: data.organization.id,
      },
    });

    assert.equal(activeClinicContext.userId, data.staff.id);
    assert.equal(activeClinicContext.organizationId, data.organization.id);
    assert.equal(activeClinicContext.clinicId, data.clinic.id);

    const createdUser = await createUserAsAdminForContext({
      adminUserId: data.admin.id,
      organizationId: data.organization.id,
      name: "New Staff",
      email: "New-Staff@example.test",
      password: "NewStaff123!",
      role: "staff",
    });
    const storedCreatedUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: createdUser.id,
      },
    });
    const createdAssignments = await prisma.userClinicAssignment.findMany({
      where: {
        userId: createdUser.id,
      },
    });

    assert.equal(storedCreatedUser.email, "new-staff@example.test");
    assert.equal(storedCreatedUser.role, userRoles.staff);
    assert.equal(storedCreatedUser.isActive, true);
    assert.equal(await bcrypt.compare("NewStaff123!", storedCreatedUser.passwordHash), true);
    assert.equal(createdAssignments.length, 1);
    assert.equal(createdAssignments[0]?.clinicId, data.clinic.id);

    await assert.rejects(() =>
      createUserAsAdminForContext({
        adminUserId: data.admin.id,
        organizationId: data.organization.id,
        name: "Duplicate",
        email: "new-staff@example.test",
        password: "Duplicate123!",
        role: "STAFF",
      }),
    );

    await resetUserPasswordAsAdminForContext({
      adminUserId: data.admin.id,
      organizationId: data.organization.id,
      userId: data.staff.id,
      password: "ResetStaff123!",
    });
    const staffAfterReset = await prisma.user.findUniqueOrThrow({
      where: {
        id: data.staff.id,
      },
    });

    assert.equal(await bcrypt.compare(data.staffPassword, staffAfterReset.passwordHash), false);
    assert.equal(await bcrypt.compare("ResetStaff123!", staffAfterReset.passwordHash), true);

    await assert.rejects(() =>
      deactivateUserAsAdminForContext({
        adminUserId: data.admin.id,
        organizationId: data.organization.id,
        userId: data.admin.id,
      }),
    );
    await assert.rejects(() =>
      deactivateUserAsAdminForContext({
        adminUserId: data.admin.id,
        organizationId: data.organization.id,
        userId: data.otherUser.id,
      }),
    );

    await deactivateUserAsAdminForContext({
      adminUserId: data.admin.id,
      organizationId: data.organization.id,
      userId: data.staff.id,
    });
    const staffAfterDeactivate = await prisma.user.findUniqueOrThrow({
      where: {
        id: data.staff.id,
      },
    });

    assert.equal(staffAfterDeactivate.isActive, false);
    assert.equal(
      await authorizeCredentials({
        email: data.staff.email,
        password: "ResetStaff123!",
      }),
      null,
    );
    await assert.rejects(
      () =>
        requireActiveClinic({
          sessionUser: {
            id: data.staff.id,
            name: data.staff.name,
            email: data.staff.email,
            organizationId: data.organization.id,
          },
          onInactiveAccount: () => {
            throw new Error(inactiveAccountMessage);
          },
        }),
      {
        message: inactiveAccountMessage,
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
