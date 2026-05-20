"use server";

import bcrypt from "bcryptjs";
import { ZodError } from "zod";
import { auth } from "@/auth";
import { changePasswordSchema } from "@/lib/auth/password-schema";
import { prisma } from "@/lib/db/prisma";

export type AccountActionState = {
  status?: "success" | "error";
  message?: string;
};

function toActionError(error: unknown): AccountActionState {
  if (error instanceof ZodError) {
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
    message: "パスワードを変更できませんでした。",
  };
}

export async function changePasswordForUser(inputValues: {
  userId: string;
  currentPassword: FormDataEntryValue | string | null;
  newPassword: FormDataEntryValue | string | null;
  confirmPassword: FormDataEntryValue | string | null;
}) {
  const input = changePasswordSchema.parse({
    currentPassword: inputValues.currentPassword,
    newPassword: inputValues.newPassword,
    confirmPassword: inputValues.confirmPassword,
  });

  const user = await prisma.user.findUnique({
    where: {
      id: inputValues.userId,
    },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!user) {
    throw new Error("ログインユーザーが見つかりません。");
  }

  const passwordMatches = await bcrypt.compare(input.currentPassword, user.passwordHash);

  if (!passwordMatches) {
    throw new Error("現在のパスワードが一致しません。");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12);

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      passwordHash,
    },
  });
}

export async function changePasswordAction(
  _previousState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new Error("ログインし直してから操作してください。");
    }

    await changePasswordForUser({
      userId: session.user.id,
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });

    return {
      status: "success",
      message: "パスワードを変更しました。次回ログインから新しいパスワードを使用してください。",
    };
  } catch (error) {
    return toActionError(error);
  }
}
