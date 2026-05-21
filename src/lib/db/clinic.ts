import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export const inactiveAccountMessage =
  "アカウントが無効化されています。管理者にお問い合わせください。";

export type ActiveClinicContext = {
  userId: string;
  userName: string | null | undefined;
  userEmail?: string | null;
  organizationId: string;
  clinicId: string;
  clinicName: string;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
};

type ActiveClinicSessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  organizationId: string;
};

type RequireActiveClinicOptions = {
  sessionUser?: ActiveClinicSessionUser;
  onInactiveAccount?: () => Promise<never> | never;
};

function redirectInactiveAccount(): never {
  redirect(`/logout?error=${encodeURIComponent(inactiveAccountMessage)}`);
}

export async function requireActiveClinic(
  options?: RequireActiveClinicOptions,
): Promise<ActiveClinicContext> {
  const sessionUser = options?.sessionUser ?? (await auth())?.user;

  if (!sessionUser?.id) {
    redirect("/login");
  }

  const assignment = await prisma.userClinicAssignment.findFirst({
    where: {
      userId: sessionUser.id,
      user: {
        isActive: true,
      },
      clinic: {
        organizationId: sessionUser.organizationId,
      },
    },
    select: {
      clinic: {
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          organizationId: true,
        },
      },
    },
    orderBy: {
      clinicId: "asc",
    },
  });

  if (!assignment) {
    const user = await prisma.user.findUnique({
      where: {
        id: sessionUser.id,
      },
      select: {
        isActive: true,
      },
    });

    if (!user?.isActive) {
      await (options?.onInactiveAccount ?? redirectInactiveAccount)();
    }

    throw new Error("ログインユーザーの組織で利用可能なクリニックがありません。");
  }

  return {
    userId: sessionUser.id,
    userName: sessionUser.name,
    userEmail: sessionUser.email,
    organizationId: assignment.clinic.organizationId,
    clinicId: assignment.clinic.id,
    clinicName: assignment.clinic.name,
    clinicAddress: assignment.clinic.address,
    clinicPhone: assignment.clinic.phone,
  };
}
