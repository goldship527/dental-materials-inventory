import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

export const inactiveAccountMessage =
  "アカウントが無効化されています。管理者にお問い合わせください。";
export const activeClinicCookieName = "dmi_active_clinic_id";

export type ActiveClinicOption = {
  id: string;
  name: string;
};

export type ActiveClinicContext = {
  userId: string;
  userName: string | null | undefined;
  userEmail?: string | null;
  organizationId: string;
  clinicId: string;
  clinicName: string;
  clinicAddress?: string | null;
  clinicPhone?: string | null;
  canSelectClinic?: boolean;
  availableClinics?: ActiveClinicOption[];
};

export type ActiveClinicSessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  organizationId: string;
};

type RequireActiveClinicOptions = {
  sessionUser?: ActiveClinicSessionUser;
  onInactiveAccount?: () => Promise<never> | never;
};

type UserClinicAssignmentRow = {
  clinic: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    organizationId: string;
  };
};

export type ActiveClinicSelection = {
  activeClinicId: string;
  canSelectClinic: boolean;
  clinics: ActiveClinicOption[];
} | null;

function redirectInactiveAccount(): never {
  redirect(`/logout?error=${encodeURIComponent(inactiveAccountMessage)}`);
}

async function getSelectedClinicIdFromCookie() {
  try {
    return (await cookies()).get(activeClinicCookieName)?.value;
  } catch {
    return undefined;
  }
}

function toClinicOptions(assignments: UserClinicAssignmentRow[]) {
  return assignments.map((assignment) => ({
    id: assignment.clinic.id,
    name: assignment.clinic.name,
  }));
}

function selectClinicAssignment(assignments: UserClinicAssignmentRow[], selectedClinicId: string | undefined) {
  return assignments.find((assignment) => assignment.clinic.id === selectedClinicId) ?? assignments[0];
}

async function getActiveUserWithClinicAssignments(sessionUser: ActiveClinicSessionUser) {
  return prisma.user.findFirst({
    where: {
      id: sessionUser.id,
      organizationId: sessionUser.organizationId,
    },
    select: {
      isActive: true,
      role: true,
      clinicAssignments: {
        where: {
          clinic: {
            organizationId: sessionUser.organizationId,
            isActive: true,
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
      },
    },
  });
}

export async function getActiveClinicSelection(
  sessionUser: ActiveClinicSessionUser | null | undefined,
): Promise<ActiveClinicSelection> {
  if (!sessionUser?.id) {
    return null;
  }

  const user = await getActiveUserWithClinicAssignments(sessionUser);

  if (!user?.isActive || !isAdminRole(user.role) || user.clinicAssignments.length <= 1) {
    return null;
  }

  const selectedClinicId = await getSelectedClinicIdFromCookie();
  const selectedAssignment = selectClinicAssignment(user.clinicAssignments, selectedClinicId);

  if (!selectedAssignment) {
    return null;
  }

  return {
    activeClinicId: selectedAssignment.clinic.id,
    canSelectClinic: true,
    clinics: toClinicOptions(user.clinicAssignments),
  };
}

export async function requireActiveClinic(
  options?: RequireActiveClinicOptions,
): Promise<ActiveClinicContext> {
  const sessionUser = options?.sessionUser ?? (await auth())?.user;

  if (!sessionUser?.id) {
    redirect("/login");
  }

  const user = await getActiveUserWithClinicAssignments(sessionUser);

  if (!user?.isActive || user.clinicAssignments.length === 0) {
    if (!user?.isActive) {
      await (options?.onInactiveAccount ?? redirectInactiveAccount)();
    }

    throw new Error("ログインユーザーの組織で利用可能なクリニックがありません。");
  }

  const canSelectClinic = isAdminRole(user.role);
  const selectedClinicId = canSelectClinic ? await getSelectedClinicIdFromCookie() : undefined;
  const assignment = selectClinicAssignment(user.clinicAssignments, selectedClinicId);
  const availableClinics = canSelectClinic ? toClinicOptions(user.clinicAssignments) : [];

  return {
    userId: sessionUser.id,
    userName: sessionUser.name,
    userEmail: sessionUser.email,
    organizationId: assignment.clinic.organizationId,
    clinicId: assignment.clinic.id,
    clinicName: assignment.clinic.name,
    clinicAddress: assignment.clinic.address,
    clinicPhone: assignment.clinic.phone,
    canSelectClinic,
    availableClinics,
  };
}
