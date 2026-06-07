"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auditActions, writeAuditLog } from "@/lib/audit/audit-log";
import { requireAdminContext } from "@/lib/actions/admin-users";
import { prisma } from "@/lib/db/prisma";
import { getNextStaffOperatorBarcode, normalizeStaffOperatorBarcode, staffOperatorTypes } from "@/lib/db/staff-operators";

export type StaffOperatorActionState = {
  status?: "success" | "error";
  message?: string;
};

const staffOperatorBarcodeSchema = z
  .string()
  .trim()
  .min(3, "担当者バーコードは3文字以上で入力してください。")
  .max(64, "担当者バーコードは64文字以内で入力してください。")
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "担当者バーコードは英数字、ハイフン、アンダーバーで入力してください。")
  .transform((value) => normalizeStaffOperatorBarcode(value));

const createStaffOperatorSchema = z.object({
  displayName: z.string().trim().min(1, "担当者名を入力してください。").max(100, "担当者名は100文字以内で入力してください。"),
  barcode: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const trimmed = value.trim();

      return trimmed ? trimmed : undefined;
    },
    staffOperatorBarcodeSchema.optional(),
  ),
  clinicIds: z.array(z.string().trim().min(1)).min(1, "利用できるクリニックを1つ以上選んでください。"),
});
const updateStaffOperatorSchema = z.object({
  displayName: z.string().trim().min(1, "担当者名を入力してください。").max(100, "担当者名は100文字以内で入力してください。"),
  clinicIds: z.array(z.string().trim().min(1)).min(1, "利用できるクリニックを1つ以上選んでください。"),
  staffOperatorId: z.string().trim().min(1),
});
const staffOperatorIdSchema = z.object({
  staffOperatorId: z.string().trim().min(1),
});

function toActionError(error: unknown): StaffOperatorActionState {
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
    message: "スタッフ担当者の処理に失敗しました。",
  };
}

function isBarcodeUniqueConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.includes("organizationId") && target.includes("barcode");
  }

  return typeof target === "string" ? target.includes("barcode") : true;
}

async function assertClinicIdsBelongToOrganization(organizationId: string, clinicIds: string[]) {
  const uniqueClinicIds = Array.from(new Set(clinicIds));
  const clinics = await prisma.clinic.findMany({
    where: {
      organizationId,
      isActive: true,
      id: {
        in: uniqueClinicIds,
      },
    },
    select: {
      id: true,
    },
  });

  if (clinics.length !== uniqueClinicIds.length) {
    throw new Error("利用できないクリニックが含まれています。");
  }

  return uniqueClinicIds;
}

export async function createStaffOperatorForContext(options: {
  adminUserId: string;
  organizationId: string;
  displayName: string;
  barcode?: string;
  clinicIds: string[];
}) {
  const input = createStaffOperatorSchema.parse(options);
  const clinicIds = await assertClinicIdsBelongToOrganization(options.organizationId, input.clinicIds);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const staffOperator = await prisma.$transaction(async (tx) => {
        const barcode = input.barcode ?? (await getNextStaffOperatorBarcode(options.organizationId, tx));
        const created = await tx.staffOperator.create({
          data: {
            organizationId: options.organizationId,
            displayName: input.displayName,
            barcode,
            operatorType: staffOperatorTypes.regular,
            isActive: true,
          },
          select: {
            id: true,
          },
        });

        await tx.staffOperatorClinicAssignment.createMany({
          data: clinicIds.map((clinicId) => ({
            staffOperatorId: created.id,
            clinicId,
          })),
        });

        return created;
      });

      await writeAuditLog({
        organizationId: options.organizationId,
        actorUserId: options.adminUserId,
        action: auditActions.staffOperatorCreate,
        targetType: "StaffOperator",
        targetId: staffOperator.id,
        details: {
          clinicCount: clinicIds.length,
        },
      });

      return staffOperator;
    } catch (error) {
      if (isBarcodeUniqueConflict(error) && !input.barcode) {
        continue;
      }

      if (isBarcodeUniqueConflict(error)) {
        throw new Error("同じ担当者バーコードがすでに登録されています。");
      }

      throw error;
    }
  }

  throw new Error("空いている担当者バーコードを自動採番できませんでした。もう一度お試しください。");
}

export async function deactivateStaffOperatorForContext(options: {
  adminUserId: string;
  organizationId: string;
  staffOperatorId: string;
}) {
  const input = staffOperatorIdSchema.parse(options);
  const staffOperator = await prisma.staffOperator.findFirst({
    where: {
      id: input.staffOperatorId,
      organizationId: options.organizationId,
    },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!staffOperator) {
    throw new Error("対象のスタッフ担当者が見つかりません。");
  }

  if (!staffOperator.isActive) {
    return;
  }

  await prisma.staffOperator.update({
    where: {
      id: staffOperator.id,
    },
    data: {
      isActive: false,
    },
  });

  await writeAuditLog({
    organizationId: options.organizationId,
    actorUserId: options.adminUserId,
    action: auditActions.staffOperatorDeactivate,
    targetType: "StaffOperator",
    targetId: staffOperator.id,
  });
}

export async function updateStaffOperatorForContext(options: {
  adminUserId: string;
  organizationId: string;
  staffOperatorId: string;
  displayName: string;
  clinicIds: string[];
}) {
  const input = updateStaffOperatorSchema.parse(options);
  const clinicIds = await assertClinicIdsBelongToOrganization(options.organizationId, input.clinicIds);
  const staffOperator = await prisma.staffOperator.findFirst({
    where: {
      id: input.staffOperatorId,
      organizationId: options.organizationId,
    },
    select: {
      id: true,
    },
  });

  if (!staffOperator) {
    throw new Error("対象のスタッフ担当者が見つかりません。");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.staffOperator.update({
        where: {
          id: staffOperator.id,
        },
        data: {
          displayName: input.displayName,
        },
      });

      await tx.staffOperatorClinicAssignment.deleteMany({
        where: {
          staffOperatorId: staffOperator.id,
        },
      });

      await tx.staffOperatorClinicAssignment.createMany({
        data: clinicIds.map((clinicId) => ({
          staffOperatorId: staffOperator.id,
          clinicId,
        })),
      });
    });

    await writeAuditLog({
      organizationId: options.organizationId,
      actorUserId: options.adminUserId,
      action: auditActions.staffOperatorUpdate,
      targetType: "StaffOperator",
      targetId: staffOperator.id,
      details: {
        clinicCount: clinicIds.length,
      },
    });
  } catch (error) {
    if (isBarcodeUniqueConflict(error)) {
      throw new Error("同じ担当者バーコードがすでに登録されています。");
    }

    throw error;
  }
}

export async function createStaffOperatorAction(
  _previousState: StaffOperatorActionState,
  formData: FormData,
): Promise<StaffOperatorActionState> {
  try {
    const context = await requireAdminContext();

    await createStaffOperatorForContext({
      adminUserId: context.userId,
      organizationId: context.organizationId,
      displayName: String(formData.get("displayName") ?? ""),
      barcode: String(formData.get("barcode") ?? ""),
      clinicIds: formData.getAll("clinicIds").map(String),
    });
    revalidatePath("/admin/staff-operators");

    return {
      status: "success",
      message: "スタッフ担当者を追加しました。",
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateStaffOperatorAction(
  _previousState: StaffOperatorActionState,
  formData: FormData,
): Promise<StaffOperatorActionState> {
  try {
    const context = await requireAdminContext();

    await updateStaffOperatorForContext({
      adminUserId: context.userId,
      organizationId: context.organizationId,
      staffOperatorId: String(formData.get("staffOperatorId") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      clinicIds: formData.getAll("clinicIds").map(String),
    });
    revalidatePath("/admin/staff-operators");

    return {
      status: "success",
      message: "スタッフ担当者を更新しました。",
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deactivateStaffOperatorAction(
  _previousState: StaffOperatorActionState,
  formData: FormData,
): Promise<StaffOperatorActionState> {
  try {
    const context = await requireAdminContext();

    await deactivateStaffOperatorForContext({
      adminUserId: context.userId,
      organizationId: context.organizationId,
      staffOperatorId: String(formData.get("staffOperatorId") ?? ""),
    });
    revalidatePath("/admin/staff-operators");

    return {
      status: "success",
      message: "スタッフ担当者を無効化しました。",
    };
  } catch (error) {
    return toActionError(error);
  }
}
