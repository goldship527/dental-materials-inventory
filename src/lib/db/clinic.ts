import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export type ActiveClinicContext = {
  userId: string;
  userName: string | null | undefined;
  organizationId: string;
  clinicId: string;
  clinicName: string;
};

export async function requireActiveClinic(): Promise<ActiveClinicContext> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const assignment = await prisma.userClinicAssignment.findFirst({
    where: {
      userId: session.user.id,
      clinic: {
        organizationId: session.user.organizationId,
      },
    },
    select: {
      clinic: {
        select: {
          id: true,
          name: true,
          organizationId: true,
        },
      },
    },
    orderBy: {
      clinicId: "asc",
    },
  });

  if (!assignment) {
    throw new Error("ログインユーザーの組織で利用可能なクリニックがありません。");
  }

  return {
    userId: session.user.id,
    userName: session.user.name,
    organizationId: assignment.clinic.organizationId,
    clinicId: assignment.clinic.id,
    clinicName: assignment.clinic.name,
  };
}
