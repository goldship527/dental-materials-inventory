import { prisma } from "@/lib/db/prisma";
import { normalizeBarcodeText } from "@/lib/barcode/normalize";

export const staffOperatorTypes = {
  regular: "REGULAR",
} as const;

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

export type StaffOperatorOption = {
  id: string;
  displayName: string;
};

export function normalizeStaffOperatorBarcode(value: string) {
  return normalizeBarcodeText(value).toUpperCase();
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

export async function getActiveStaffOperatorOptionsForClinic(options: {
  organizationId: string;
  clinicId: string;
}): Promise<StaffOperatorOption[]> {
  const rows = await prisma.staffOperator.findMany({
    where: {
      organizationId: options.organizationId,
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
    orderBy: {
      displayName: "asc",
    },
    select: {
      id: true,
      displayName: true,
    },
  });

  return rows;
}

export async function findActiveStaffOperatorByIdForClinic(options: {
  organizationId: string;
  clinicId: string;
  staffOperatorId: string;
}) {
  return prisma.staffOperator.findFirst({
    where: {
      id: options.staffOperatorId,
      organizationId: options.organizationId,
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
