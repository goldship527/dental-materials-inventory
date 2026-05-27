"use server";

import { revalidatePath } from "next/cache";
import { auditActions } from "@/lib/audit/audit-log";
import { requireAdminUser } from "@/lib/auth/admin";
import { parseAnomalyOutThreshold } from "@/lib/db/organization-settings";
import { prisma } from "@/lib/db/prisma";

export type OrganizationSettingsActionState = {
  status?: "success" | "error";
  message?: string;
};

export async function updateOrganizationSettingsAction(
  _previousState: OrganizationSettingsActionState,
  formData: FormData,
): Promise<OrganizationSettingsActionState> {
  try {
    const context = await requireAdminUser({
      unauthorizedRedirectTo: "/home",
    });
    const anomalyOutThreshold = parseAnomalyOutThreshold(formData.get("anomalyOutThreshold") ?? "");

    await prisma.$transaction(async (tx) => {
      const previous = await tx.organizationSetting.findUnique({
        where: {
          organizationId: context.organizationId,
        },
        select: {
          anomalyOutThreshold: true,
        },
      });

      await tx.organizationSetting.upsert({
        where: {
          organizationId: context.organizationId,
        },
        update: {
          anomalyOutThreshold,
        },
        create: {
          organizationId: context.organizationId,
          anomalyOutThreshold,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: context.organizationId,
          actorUserId: context.userId,
          action: auditActions.anomalyThresholdUpdate,
          targetType: "OrganizationSetting",
          targetId: context.organizationId,
          detailsJson: {
            previousThreshold: previous?.anomalyOutThreshold ?? null,
            nextThreshold: anomalyOutThreshold,
          },
        },
      });
    });

    revalidatePath("/admin/settings");
    revalidatePath("/home");
    revalidatePath("/movements/anomalies");

    return {
      status: "success",
      message: "異常出庫検知の閾値を更新しました。",
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        status: "error",
        message: error.message,
      };
    }

    return {
      status: "error",
      message: "異常出庫検知の設定を更新できませんでした。",
    };
  }
}
