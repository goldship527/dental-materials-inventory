import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const notificationChannelEmail = "EMAIL";

export const dailyDigestItemKeys = [
  "shortage",
  "stockLots",
  "pendingOrders",
  "dormantStock",
  "stockAnomalies",
] as const;

export type DailyDigestItemKey = (typeof dailyDigestItemKeys)[number];

export type DailyDigestItems = Record<DailyDigestItemKey, boolean>;

export type NotificationPreferenceView = {
  id: string | null;
  organizationId: string;
  userId: string;
  channel: string;
  isEnabled: boolean;
  dailyDigestTime: string;
  dailyDigestWeekdays: string[];
  items: DailyDigestItems;
};

export const defaultDailyDigestTime = "07:00";
export const defaultDailyDigestWeekdays = ["MON", "TUE", "WED", "THU", "FRI"];

export const weekdayOptions = [
  { value: "MON", label: "月" },
  { value: "TUE", label: "火" },
  { value: "WED", label: "水" },
  { value: "THU", label: "木" },
  { value: "FRI", label: "金" },
  { value: "SAT", label: "土" },
  { value: "SUN", label: "日" },
] as const;

export const dailyDigestItemLabels: Record<DailyDigestItemKey, string> = {
  shortage: "不足在庫",
  stockLots: "期限ロット",
  pendingOrders: "納品待ち",
  dormantStock: "長期在庫",
  stockAnomalies: "異常出庫検知",
};

export function defaultDailyDigestItems(): DailyDigestItems {
  return {
    shortage: true,
    stockLots: true,
    pendingOrders: true,
    dormantStock: true,
    stockAnomalies: true,
  };
}

export function parseDailyDigestItems(value: Prisma.JsonValue | unknown): DailyDigestItems {
  const defaults = defaultDailyDigestItems();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const record = value as Record<string, unknown>;

  return Object.fromEntries(
    dailyDigestItemKeys.map((key) => [key, typeof record[key] === "boolean" ? record[key] : defaults[key]]),
  ) as DailyDigestItems;
}

export function parseWeekdays(value: string | null | undefined): string[] {
  const allowed = new Set<string>(weekdayOptions.map((option) => option.value));
  const weekdays = (value ?? "")
    .split(",")
    .map((weekday) => weekday.trim().toUpperCase())
    .filter((weekday) => allowed.has(weekday));

  return weekdays.length > 0 ? weekdays : defaultDailyDigestWeekdays;
}

export function stringifyWeekdays(values: string[]) {
  const selected = parseWeekdays(values.join(","));

  return selected.join(",");
}

export function parseDailyDigestTime(value: unknown) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) {
    throw new Error("配信時刻は HH:mm 形式で入力してください。");
  }

  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error("配信時刻は 00:00 から 23:59 の範囲で入力してください。");
  }

  if (minute % 30 !== 0) {
    throw new Error("配信時刻は30分単位で入力してください。");
  }

  return value;
}

export async function getNotificationPreferenceForUser(
  organizationId: string,
  userId: string,
): Promise<NotificationPreferenceView> {
  const preference = await prisma.notificationPreference.findUnique({
    where: {
      userId_channel: {
        userId,
        channel: notificationChannelEmail,
      },
    },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      channel: true,
      isEnabled: true,
      dailyDigestTime: true,
      dailyDigestWeekdays: true,
      itemsJson: true,
    },
  });

  return {
    id: preference?.id ?? null,
    organizationId,
    userId,
    channel: notificationChannelEmail,
    isEnabled: preference?.isEnabled ?? true,
    dailyDigestTime: preference?.dailyDigestTime ?? defaultDailyDigestTime,
    dailyDigestWeekdays: parseWeekdays(preference?.dailyDigestWeekdays),
    items: parseDailyDigestItems(preference?.itemsJson),
  };
}
