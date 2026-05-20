import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { changePasswordForUser } = await import("../src/lib/actions/account");

  try {
    const organization = await prisma.organization.create({
      data: {
        name: "Test Organization",
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Test User",
        email: `account-${Date.now()}@example.test`,
        passwordHash: await bcrypt.hash("oldPassword1!", 4),
      },
    });

    await changePasswordForUser({
      userId: user.id,
      currentPassword: "oldPassword1!",
      newPassword: "newPassword1!",
      confirmPassword: "newPassword1!",
    });

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: user.id,
      },
    });

    assert.equal(await bcrypt.compare("newPassword1!", updatedUser.passwordHash), true);
    assert.equal(await bcrypt.compare("oldPassword1!", updatedUser.passwordHash), false);

    await assert.rejects(() =>
      changePasswordForUser({
        userId: user.id,
        currentPassword: "wrongPassword1!",
        newPassword: "anotherPassword1!",
        confirmPassword: "anotherPassword1!",
      }),
    );
    await assert.rejects(() =>
      changePasswordForUser({
        userId: user.id,
        currentPassword: "newPassword1!",
        newPassword: "anotherPassword1!",
        confirmPassword: "differentPassword1!",
      }),
    );
    await assert.rejects(() =>
      changePasswordForUser({
        userId: user.id,
        currentPassword: "newPassword1!",
        newPassword: "short1!",
        confirmPassword: "short1!",
      }),
    );
    await assert.rejects(() =>
      changePasswordForUser({
        userId: user.id,
        currentPassword: "newPassword1!",
        newPassword: "password日本語1!",
        confirmPassword: "password日本語1!",
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
