import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

export type AdminUserContext = {
  userId: string;
  organizationId: string;
};

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

  if (!user?.isActive || !isAdminRole(user.role)) {
    redirect(options?.unauthorizedRedirectTo ?? "/home");
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
  };
}
