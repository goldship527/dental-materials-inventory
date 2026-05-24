import { prisma } from "@/lib/db/prisma";

export const staffOperatorTypes = {
  regular: "REGULAR",
  help: "HELP",
} as const;

export type StaffOperatorType = (typeof staffOperatorTypes)[keyof typeof staffOperatorTypes];

export const staffOperatorTypeLabels: Record<string, string> = {
  REGULAR: "通常スタッフ",
  HELP: "ヘルプ",
};

export type StaffOperatorRow = {
  id: string;
  displayName: string;
  barcode: string;
  operatorType: string;
  isActive: boolean;
  updatedAt: Date;
  assignedClinics: {
    id: string;
    name: string;
  }[];
};

export type StaffOperatorClinicOption = {
  id: string;
  name: string;
};

export function normalizeStaffOperatorBarcode(value: string) {
  return value.trim().toUpperCase();
}

export async function getStaffOperatorRows(organizationId: string): Promise<StaffOperatorRow[]> {
  const rows = await prisma.staffOperator.findMany({
    where: {
      organizationId,
    },
    include: {
      clinicAssignments: {
        include: {
          clinic: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          clinic: {
            name: "asc",
          },
        },
      },
    },
    orderBy: [
      {
        isActive: "desc",
      },
      {
        operatorType: "asc",
      },
      {
        displayName: "asc",
      },
    ],
  });

  return rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    barcode: row.barcode,
    operatorType: row.operatorType,
    isActive: row.isActive,
    updatedAt: row.updatedAt,
    assignedClinics: row.clinicAssignments.map((assignment) => ({
      id: assignment.clinic.id,
      name: assignment.clinic.name,
    })),
  }));
}

export async function getStaffOperatorClinicOptions(organizationId: string): Promise<StaffOperatorClinicOption[]> {
  return prisma.clinic.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });
}

export async function findActiveStaffOperatorForClinic(options: {
  organizationId: string;
  clinicId: string;
  barcode: string;
}) {
  const barcode = normalizeStaffOperatorBarcode(options.barcode);

  if (!barcode) {
    return null;
  }

  return prisma.staffOperator.findFirst({
    where: {
      organizationId: options.organizationId,
      barcode,
      isActive: true,
      clinicAssignments: {
        some: {
          clinicId: options.clinicId,
          clinic: {
            isActive: true,
          },
        },
      },
    },
    select: {
      id: true,
      displayName: true,
      operatorType: true,
    },
  });
}
