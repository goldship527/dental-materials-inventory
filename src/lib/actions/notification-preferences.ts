"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { auditActions, writeAuditLog } from "@/lib/audit/audit-log";
import { prisma } from "@/lib/db/prisma";
import {
  dailyDigestItemKeys,
  notificationChannelEmail,
  parseDailyDigestTime,
  parseWeekdays,
  stringifyWeekdays,
  type DailyDigestItems,
} from "@/lib/notifications/preferences";

export type NotificationPreferenceActionState = {
  status?: "success" | "error";
  message?: string;
};

const initialDailyDigestItems = Object.fromEntries(dailyDigestItemKeys.map((key) => [key, false])) as DailyDigestItems;

export async function updateNotificationPreferenceAction(
  _previousState: NotificationPreferenceActionState,
  formData: FormData,
): Promise<NotificationPreferenceActionState> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return {
        status: "error",
        message: "ログインが必要です。",
      };
    }

    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        organizationId: true,
        isActive: true,
      },
    });

    if (!user?.isActive) {
      return {
        status: "error",
        message: "アカウントが無効です。",
      };
    }

    const dailyDigestTime = parseDailyDigestTime(formData.get("dailyDigestTime"));
    const weekdays = parseWeekdays(formData.getAll("dailyDigestWeekdays").map(String).join(","));
    const items = {
      ...initialDailyDigestItems,
      ...Object.fromEntries(dailyDigestItemKeys.map((key) => [key, formData.get(`item:${key}`) === "on"])),
    };
    const isEnabled = formData.get("isEnabled") === "on";

    await prisma.notificationPreference.upsert({
      where: {
        userId_channel: {
          userId: user.id,
          channel: notificationChannelEmail,
        },
      },
      update: {
        organizationId: user.organizationId,
        isEnabled,
        dailyDigestTime,
        dailyDigestWeekdays: stringifyWeekdays(weekdays),
        itemsJson: items,
      },
      create: {
        organizationId: user.organizationId,
        userId: user.id,
        channel: notificationChannelEmail,
        isEnabled,
        dailyDigestTime,
        dailyDigestWeekdays: stringifyWeekdays(weekdays),
        itemsJson: items,
      },
    });

    await writeAuditLog({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: auditActions.notificationPreferenceUpdate,
      targetType: "NotificationPreference",
      targetId: user.id,
      details: {
        channel: notificationChannelEmail,
        isEnabled,
        dailyDigestTime,
        dailyDigestWeekdays: stringifyWeekdays(weekdays),
      },
    });

    revalidatePath("/account/notifications");

    return {
      status: "success",
      message: "通知設定を保存しました。",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "通知設定を保存できませんでした。",
    };
  }
}
