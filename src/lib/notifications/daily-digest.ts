import { countDormantStockRows } from "@/lib/db/dormant-stock";
import { prisma } from "@/lib/db/prisma";
import { countStockAnomalies } from "@/lib/db/stock-anomalies";
import { countAttentionStockLots } from "@/lib/db/stock-lots";
import { getStockRows } from "@/lib/db/stock";
import {
  dailyDigestItemLabels,
  notificationChannelEmail,
  parseDailyDigestItems,
  parseWeekdays,
  type DailyDigestItemKey,
  type DailyDigestItems,
} from "@/lib/notifications/preferences";
import { getEmailSenderReadiness, sendEmail } from "@/lib/notifications/email-sender";

export type DailyDigestLine = {
  key: DailyDigestItemKey;
  label: string;
  count: number;
  href: string;
};

export type DailyDigest = {
  organizationId: string;
  clinicId: string;
  clinicName: string;
  generatedAt: string;
  lines: DailyDigestLine[];
};

export type DueDigestPreference = {
  id: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  userName: string;
  channel: string;
  dailyDigestTime: string;
  dailyDigestWeekdays: string;
  items: DailyDigestItems;
  clinicId: string;
  clinicName: string;
  scheduledFor: Date;
};

const jstOffsetMinutes = 9 * 60;
const weekdayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function getAppBaseUrl() {
  return (process.env.APP_BASE_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

function getLocalDate(now: Date, offsetMinutes = jstOffsetMinutes) {
  return new Date(now.getTime() + offsetMinutes * 60 * 1000);
}

function getLocalTimeSlot(now: Date, offsetMinutes = jstOffsetMinutes) {
  const local = getLocalDate(now, offsetMinutes);
  const hour = local.getUTCHours();
  const minute = local.getUTCMinutes() < 30 ? 0 : 30;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getLocalWeekday(now: Date, offsetMinutes = jstOffsetMinutes) {
  const local = getLocalDate(now, offsetMinutes);

  return weekdayNames[local.getUTCDay()];
}

export function getScheduledForDate(dailyDigestTime: string, now: Date, offsetMinutes = jstOffsetMinutes) {
  const local = getLocalDate(now, offsetMinutes);
  const [hourText, minuteText] = dailyDigestTime.split(":");
  const localTimestamp = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    Number(hourText),
    Number(minuteText),
    0,
    0,
  );

  return new Date(localTimestamp - offsetMinutes * 60 * 1000);
}

export function shouldSendDailyDigestPreference(
  preference: {
    dailyDigestTime: string;
    dailyDigestWeekdays: string;
  },
  now: Date = new Date(),
) {
  return (
    preference.dailyDigestTime === getLocalTimeSlot(now) &&
    parseWeekdays(preference.dailyDigestWeekdays).includes(getLocalWeekday(now))
  );
}

async function countPendingOrders(organizationId: string, clinicId: string) {
  return prisma.orderRequest.count({
    where: {
      clinicId,
      status: "ORDERED",
      receivedAt: null,
      clinic: {
        organizationId,
      },
      product: {
        organizationId,
        isActive: true,
      },
    },
  });
}

export async function buildDailyDigest(input: {
  organizationId: string;
  clinicId: string;
  clinicName: string;
  items?: DailyDigestItems;
  now?: Date;
}): Promise<DailyDigest> {
  const items = input.items ?? {
    shortage: true,
    stockLots: true,
    pendingOrders: true,
    dormantStock: true,
    stockAnomalies: true,
  };
  const baseUrl = getAppBaseUrl();
  const [stockRows, stockLotCount, pendingOrderCount, dormantStockCount, stockAnomalyCount] = await Promise.all([
    items.shortage ? getStockRows(input.clinicId) : Promise.resolve([]),
    items.stockLots ? countAttentionStockLots(input.clinicId, input.now) : Promise.resolve(0),
    items.pendingOrders ? countPendingOrders(input.organizationId, input.clinicId) : Promise.resolve(0),
    items.dormantStock ? countDormantStockRows(input.organizationId, input.clinicId) : Promise.resolve(0),
    items.stockAnomalies ? countStockAnomalies(input.organizationId, input.clinicId) : Promise.resolve(0),
  ]);
  const counts: Record<DailyDigestItemKey, number> = {
    shortage: stockRows.filter((row) => row.isShortage).length,
    stockLots: stockLotCount,
    pendingOrders: pendingOrderCount,
    dormantStock: dormantStockCount,
    stockAnomalies: stockAnomalyCount,
  };
  const hrefs: Record<DailyDigestItemKey, string> = {
    shortage: `${baseUrl}/shortage`,
    stockLots: `${baseUrl}/stock-lots`,
    pendingOrders: `${baseUrl}/orders`,
    dormantStock: `${baseUrl}/inventory/dormant`,
    stockAnomalies: `${baseUrl}/movements/anomalies`,
  };
  const lines = (Object.keys(items) as DailyDigestItemKey[])
    .filter((key) => items[key])
    .map((key) => ({
      key,
      label: dailyDigestItemLabels[key],
      count: counts[key],
      href: hrefs[key],
    }));

  return {
    organizationId: input.organizationId,
    clinicId: input.clinicId,
    clinicName: input.clinicName,
    generatedAt: (input.now ?? new Date()).toISOString(),
    lines,
  };
}

export function renderDailyDigestEmail(digest: DailyDigest) {
  const subject = `朝の在庫ダイジェスト: ${digest.clinicName}`;
  const textLines = [
    `${digest.clinicName} の要対応サマリです。`,
    "",
    ...digest.lines.map((line) => `- ${line.label}: ${line.count}件 ${line.href}`),
    "",
    "このメールには金額、患者情報、個人情報は含めていません。",
  ];
  const htmlLines = digest.lines
    .map((line) => `<li><a href="${line.href}">${line.label}</a>: <strong>${line.count}</strong>件</li>`)
    .join("");

  return {
    subject,
    text: textLines.join("\n"),
    html: `<p>${digest.clinicName} の要対応サマリです。</p><ul>${htmlLines}</ul><p>このメールには金額、患者情報、個人情報は含めていません。</p>`,
  };
}

export async function getDueDigestPreferences(now: Date = new Date()): Promise<DueDigestPreference[]> {
  const preferences = await prisma.notificationPreference.findMany({
    where: {
      channel: notificationChannelEmail,
      isEnabled: true,
      user: {
        isActive: true,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          clinicAssignments: {
            where: {
              clinic: {
                isActive: true,
              },
            },
            select: {
              clinic: {
                select: {
                  id: true,
                  name: true,
                  organizationId: true,
                },
              },
            },
            orderBy: {
              clinicId: "asc",
            },
            take: 1,
          },
        },
      },
    },
  });
  const due: DueDigestPreference[] = [];

  for (const preference of preferences) {
    if (!shouldSendDailyDigestPreference(preference, now)) {
      continue;
    }

    const scheduledFor = getScheduledForDate(preference.dailyDigestTime, now);
    const existingDelivery = await prisma.notificationDelivery.findFirst({
      where: {
        organizationId: preference.organizationId,
        userId: preference.userId,
        channel: preference.channel,
        scheduledFor,
        status: {
          in: ["QUEUED", "SENT"],
        },
      },
      select: {
        id: true,
      },
    });
    const clinic = preference.user.clinicAssignments[0]?.clinic;

    if (existingDelivery || !clinic || clinic.organizationId !== preference.organizationId) {
      continue;
    }

    due.push({
      id: preference.id,
      organizationId: preference.organizationId,
      userId: preference.userId,
      userEmail: preference.user.email,
      userName: preference.user.name,
      channel: preference.channel,
      dailyDigestTime: preference.dailyDigestTime,
      dailyDigestWeekdays: preference.dailyDigestWeekdays,
      items: parseDailyDigestItems(preference.itemsJson),
      clinicId: clinic.id,
      clinicName: clinic.name,
      scheduledFor,
    });
  }

  return due;
}

export async function sendDueDailyDigests(now: Date = new Date()) {
  const readiness = getEmailSenderReadiness();

  if (!readiness.ready) {
    return {
      sent: 0,
      failed: 0,
      skipped: 0,
      reason: readiness.reason,
    };
  }

  const duePreferences = await getDueDigestPreferences(now);
  let sent = 0;
  let failed = 0;

  for (const preference of duePreferences) {
    const digest = await buildDailyDigest({
      organizationId: preference.organizationId,
      clinicId: preference.clinicId,
      clinicName: preference.clinicName,
      items: preference.items,
      now,
    });
    const email = renderDailyDigestEmail(digest);
    const delivery = await prisma.notificationDelivery.create({
      data: {
        organizationId: preference.organizationId,
        userId: preference.userId,
        channel: preference.channel,
        status: "QUEUED",
        subject: email.subject,
        bodyDigestJson: digest,
        attemptCount: 1,
        scheduledFor: preference.scheduledFor,
      },
    });
    const result = await sendEmail({
      to: preference.userEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    if (result.status === "sent") {
      sent += 1;
      await prisma.notificationDelivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          status: "SENT",
          sentAt: new Date(),
          lastError: null,
        },
      });
    } else {
      failed += 1;
      await prisma.notificationDelivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          status: "FAILED",
          lastError: result.reason,
        },
      });
    }
  }

  return {
    sent,
    failed,
    skipped: 0,
    reason: null,
  };
}
