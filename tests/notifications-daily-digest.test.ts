import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const {
    buildDailyDigest,
    getDueDigestPreferences,
    getScheduledForDate,
    sendDueDailyDigests,
    shouldSendDailyDigestPreference,
  } = await import("../src/lib/notifications/daily-digest");
  const { notificationChannelEmail } = await import("../src/lib/notifications/preferences");

  try {
    process.env.NOTIFICATIONS_ENABLED = "false";

    const now = new Date("2026-05-25T22:05:00.000Z"); // JST 2026-05-26 07:05, Tuesday

    assert.equal(
      shouldSendDailyDigestPreference(
        {
          dailyDigestTime: "07:00",
          dailyDigestWeekdays: "TUE",
        },
        now,
      ),
      true,
    );
    assert.equal(
      shouldSendDailyDigestPreference(
        {
          dailyDigestTime: "07:30",
          dailyDigestWeekdays: "TUE",
        },
        now,
      ),
      false,
    );
    assert.equal(getScheduledForDate("07:00", now).toISOString(), "2026-05-25T22:00:00.000Z");

    const organization = await prisma.organization.create({
      data: {
        name: "Notification Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Notification Test Clinic",
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Notification Test User",
        email: "notification-digest@example.test",
        passwordHash: "test-password-hash",
      },
    });
    await prisma.userClinicAssignment.create({
      data: {
        userId: user.id,
        clinicId: clinic.id,
      },
    });
    const shortageProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Digest Shortage Product",
        defaultMinStock: 2,
      },
    });
    const pendingProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Digest Pending Product",
        defaultMinStock: 1,
      },
    });

    await prisma.stockItem.createMany({
      data: [
        {
          clinicId: clinic.id,
          productId: shortageProduct.id,
          quantity: 0,
          minStock: 2,
        },
        {
          clinicId: clinic.id,
          productId: pendingProduct.id,
          quantity: 5,
          minStock: 1,
        },
      ],
    });
    await prisma.orderRequest.create({
      data: {
        clinicId: clinic.id,
        productId: pendingProduct.id,
        requestedQuantity: 3,
        status: "ORDERED",
        orderedAt: new Date("2026-05-25T00:00:00.000Z"),
        createdByUserId: user.id,
      },
    });

    const digest = await buildDailyDigest({
      organizationId: organization.id,
      clinicId: clinic.id,
      clinicName: clinic.name,
      items: {
        shortage: true,
        stockLots: false,
        pendingOrders: true,
        dormantStock: false,
        stockAnomalies: false,
      },
      now,
    });

    assert.deepEqual(
      digest.lines.map((line) => [line.key, line.count]),
      [
        ["shortage", 1],
        ["pendingOrders", 1],
      ],
    );

    const preference = await prisma.notificationPreference.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        channel: notificationChannelEmail,
        isEnabled: true,
        dailyDigestTime: "07:00",
        dailyDigestWeekdays: "TUE",
        itemsJson: {
          shortage: true,
          stockLots: false,
          pendingOrders: true,
          dormantStock: false,
          stockAnomalies: false,
        },
      },
    });

    const duePreferences = await getDueDigestPreferences(now);

    assert.equal(duePreferences.length, 1);
    assert.equal(duePreferences[0]?.id, preference.id);
    assert.equal(duePreferences[0]?.clinicId, clinic.id);

    await prisma.notificationDelivery.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        channel: notificationChannelEmail,
        status: "QUEUED",
        subject: "Already queued",
        bodyDigestJson: {
          lines: [],
        },
        scheduledFor: getScheduledForDate("07:00", now),
      },
    });

    assert.equal((await getDueDigestPreferences(now)).length, 0);

    const skipped = await sendDueDailyDigests(now);

    assert.equal(skipped.sent, 0);
    assert.equal(skipped.failed, 0);
    assert.equal(skipped.reason, "NOTIFICATIONS_ENABLED is not true");

    console.log("notifications-daily-digest tests passed");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
