import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

export type AdminUserContext = {
  userId: string;
  organizationId: string;
};

function redirectUnauthorizedAdmin(basePath: string | undefined, reason: string): never {
  const redirectTo = basePath ?? "/home";
  const separator = redirectTo.includes("?") ? "&" : "?";

  redirect(`${redirectTo}${separator}adminDenied=${reason}`);
}

export async function requireAdminUser(options?: {
  unauthorizedRedirectTo?: string;
}): Promise<AdminUserContext> {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
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

  if (!user) {
    redirectUnauthorizedAdmin(options?.unauthorizedRedirectTo, "user-not-found");
  }

  if (!user.isActive) {
    redirectUnauthorizedAdmin(options?.unauthorizedRedirectTo, "inactive");
  }

  if (!isAdminRole(user.role)) {
    redirectUnauthorizedAdmin(options?.unauthorizedRedirectTo, "role");
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
  };
}
