"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { auditActions, writeAuditLog } from "@/lib/audit/audit-log";
import { passwordSchema } from "@/lib/auth/password-schema";
import { isAdminRole, normalizeUserRole, userRoles } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

export type AdminUserActionState = {
  status?: "success" | "error";
  message?: string;
};

const userRoleSchema = z
  .string()
  .trim()
  .transform((value) => normalizeUserRole(value));

const createAdminUserSchema = z.object({
  name: z.string().trim().min(1, "表示名を入力してください。").max(100, "表示名は100文字以内で入力してください。"),
  email: z.string().trim().email("メールアドレスの形式を確認してください。").max(255),
  password: passwordSchema,
  role: userRoleSchema,
});

const userIdSchema = z.object({
  userId: z.string().trim().min(1),
});

const resetPasswordSchema = userIdSchema.extend({
  password: passwordSchema,
});

function toActionError(error: unknown): AdminUserActionState {
  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: error.issues[0]?.message ?? "入力内容を確認してください。",
    };
  }

  if (error instanceof Error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  return {
    status: "error",
    message: "ログインアカウント管理の処理に失敗しました。",
  };
}

function isEmailUniqueConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.includes("email");
  }

  return typeof target === "string" ? target.includes("email") : true;
}

export async function requireAdminContext() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("ログインしてから操作してください。");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      organizationId: true,
      role: true,
      isActive: true,
    },
  });

  if (!user?.isActive || !isAdminRole(user.role)) {
    throw new Error("管理者だけが操作できます。");
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
  };
}

export async function createUserAsAdminForContext(options: {
  adminUserId: string;
  organizationId: string;
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  const input = createAdminUserSchema.parse(options);
  const email = input.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw new Error("同じメールアドレスのユーザーが既に存在します。");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: options.organizationId,
          name: input.name,
          email,
          passwordHash,
          role: input.role,
          isActive: true,
        },
        select: {
          id: true,
        },
      });
      const clinics = await tx.clinic.findMany({
        where: {
          organizationId: options.organizationId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (clinics.length > 0) {
        await tx.userClinicAssignment.createMany({
          data: clinics.map((clinic) => ({
            userId: user.id,
            clinicId: clinic.id,
          })),
          skipDuplicates: true,
        });
      }

      return user;
    });

    await writeAuditLog({
      organizationId: options.organizationId,
      actorUserId: options.adminUserId,
      action: auditActions.adminUserCreate,
      targetType: "User",
      targetId: createdUser.id,
      details: {
        role: input.role,
      },
    });

    return createdUser;
  } catch (error) {
    if (isEmailUniqueConflict(error)) {
      throw new Error("同じメールアドレスのユーザーが既に存在します。");
    }

    throw error;
  }
}

export async function deactivateUserAsAdminForContext(options: {
  adminUserId: string;
  organizationId: string;
  userId: string;
}) {
  const input = userIdSchema.parse(options);

  if (input.userId === options.adminUserId) {
    throw new Error("自分自身のアカウントは無効化できません。");
  }

  const user = await prisma.user.findFirst({
    where: {
      id: input.userId,
      organizationId: options.organizationId,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new Error("対象ユーザーが見つかりません。");
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      isActive: false,
    },
  });

  await writeAuditLog({
    organizationId: options.organizationId,
    actorUserId: options.adminUserId,
    action: auditActions.adminUserDeactivate,
    targetType: "User",
    targetId: user.id,
  });
}

export async function resetUserPasswordAsAdminForContext(options: {
  adminUserId: string;
  organizationId: string;
  userId: string;
  password: string;
}) {
  const input = resetPasswordSchema.parse(options);

  const user = await prisma.user.findFirst({
    where: {
      id: input.userId,
      organizationId: options.organizationId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new Error("有効な対象ユーザーが見つかりません。");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      passwordHash,
    },
  });

  await writeAuditLog({
    organizationId: options.organizationId,
    actorUserId: options.adminUserId,
    action: auditActions.adminUserPasswordReset,
    targetType: "User",
    targetId: user.id,
  });
}

export async function createAdminUserAction(
  _previousState: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const context = await requireAdminContext();

    await createUserAsAdminForContext({
      adminUserId: context.userId,
      organizationId: context.organizationId,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      role: String(formData.get("role") ?? userRoles.staff),
    });
    revalidatePath("/admin/users");

    return {
      status: "success",
      message: "ユーザーを追加しました。",
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deactivateAdminUserAction(
  _previousState: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const context = await requireAdminContext();

    await deactivateUserAsAdminForContext({
      adminUserId: context.userId,
      organizationId: context.organizationId,
      userId: String(formData.get("userId") ?? ""),
    });
    revalidatePath("/admin/users");

    return {
      status: "success",
      message: "ユーザーを無効化しました。",
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function resetAdminUserPasswordAction(
  _previousState: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const context = await requireAdminContext();

    await resetUserPasswordAsAdminForContext({
      adminUserId: context.userId,
      organizationId: context.organizationId,
      userId: String(formData.get("userId") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    revalidatePath("/admin/users");

    return {
      status: "success",
      message: "パスワードをリセットしました。",
    };
  } catch (error) {
    return toActionError(error);
  }
}
