import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { resetTestDatabase } from "./helpers/db";

async function seedUser(prisma: typeof import("../src/lib/db/prisma").prisma) {
  const organization = await prisma.organization.create({
    data: {
      name: "Login Attempt Test Organization",
    },
  });

  return prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Login Attempt User",
      email: "login-attempt@example.test",
      passwordHash: await bcrypt.hash("CorrectPass123!", 12),
      role: "ADMIN",
      isActive: true,
    },
  });
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { authorizeCredentials } = await import("../src/lib/auth/config");
  const { cleanupOldLoginAttempts } = await import("../src/lib/auth/login-attempts");

  try {
    const user = await seedUser(prisma);
    const ipAddress = "203.0.113.10";

    for (let index = 0; index < 5; index += 1) {
      assert.equal(
        await authorizeCredentials(
          {
            email: user.email,
            password: "WrongPass123!",
          },
          {
            ipAddress,
          },
        ),
        null,
      );
    }

    const lockedAttempt = await prisma.loginAttempt.findUniqueOrThrow({
      where: {
        email_ipAddress: {
          email: user.email,
          ipAddress,
        },
      },
    });

    assert.equal(lockedAttempt.failedCount, 5);
    assert.ok(lockedAttempt.lockedUntil);
    assert.equal(
      await authorizeCredentials(
        {
          email: user.email,
          password: "CorrectPass123!",
        },
        {
          ipAddress,
        },
      ),
      null,
    );

    await prisma.loginAttempt.update({
      where: {
        email_ipAddress: {
          email: user.email,
          ipAddress,
        },
      },
      data: {
        lockedUntil: new Date(Date.now() - 60_000),
      },
    });

    const authorized = await authorizeCredentials(
      {
        email: user.email,
        password: "CorrectPass123!",
      },
      {
        ipAddress,
      },
    );
    const remainingAttempt = await prisma.loginAttempt.findUnique({
      where: {
        email_ipAddress: {
          email: user.email,
          ipAddress,
        },
      },
    });

    assert.equal(authorized?.id, user.id);
    assert.equal(remainingAttempt, null);

    const oldUpdatedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const recentUpdatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    await prisma.loginAttempt.createMany({
      data: [
        {
          email: "old-login-attempt@example.test",
          ipAddress: "203.0.113.20",
          failedCount: 1,
          lastFailedAt: oldUpdatedAt,
          createdAt: oldUpdatedAt,
          updatedAt: oldUpdatedAt,
        },
        {
          email: "recent-login-attempt@example.test",
          ipAddress: "203.0.113.21",
          failedCount: 1,
          lastFailedAt: recentUpdatedAt,
          createdAt: recentUpdatedAt,
          updatedAt: recentUpdatedAt,
        },
      ],
    });

    await cleanupOldLoginAttempts();

    assert.equal(
      await prisma.loginAttempt.findUnique({
        where: {
          email_ipAddress: {
            email: "old-login-attempt@example.test",
            ipAddress: "203.0.113.20",
          },
        },
      }),
      null,
    );
    assert.ok(
      await prisma.loginAttempt.findUnique({
        where: {
          email_ipAddress: {
            email: "recent-login-attempt@example.test",
            ipAddress: "203.0.113.21",
          },
        },
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
