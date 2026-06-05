"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { activeClinicCookieName } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";

function normalizeReturnTo(value: FormDataEntryValue | null) {
  const returnTo = typeof value === "string" ? value : "";

  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/home";
  }

  return returnTo;
}

export async function switchActiveClinicAction(formData: FormData): Promise<never> {
  const session = await auth();
  const returnTo = normalizeReturnTo(formData.get("returnTo"));
  const clinicId = String(formData.get("clinicId") ?? "");

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      organizationId: session.user.organizationId,
      isActive: true,
    },
    select: {
      role: true,
      clinicAssignments: {
        where: {
          clinicId,
          clinic: {
            organizationId: session.user.organizationId,
            isActive: true,
          },
        },
        select: {
          clinicId: true,
        },
        take: 1,
      },
    },
  });

  if (!user || !isAdminRole(user.role) || user.clinicAssignments.length === 0) {
    redirect(returnTo);
  }

  (await cookies()).set(activeClinicCookieName, clinicId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect(returnTo);
}
