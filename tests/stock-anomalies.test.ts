import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const {
    detectAnomaly,
    getStockAnomalies,
  } = await import("../src/lib/db/stock-anomalies");
  const {
    defaultAnomalyOutThreshold,
    getOrganizationSettings,
    parseAnomalyOutThreshold,
  } = await import("../src/lib/db/organization-settings");

  try {
    assert.deepEqual(detectAnomaly({ baselineDaily: 2, todayQuantity: 6, threshold: 3 }), {
      isAnomaly: true,
      ratio: 3,
    });
    assert.deepEqual(detectAnomaly({ baselineDaily: 2, todayQuantity: 5, threshold: 3 }), {
      isAnomaly: false,
      ratio: 2.5,
    });
    assert.deepEqual(detectAnomaly({ baselineDaily: 0.05, todayQuantity: 10, threshold: 3 }), {
      isAnomaly: false,
      ratio: 0,
    });
    assert.equal(parseAnomalyOutThreshold("3.5"), 3.5);
    assert.throws(() => parseAnomalyOutThreshold("1.4"));
    assert.throws(() => parseAnomalyOutThreshold("10.1"));

    const now = new Date("2026-05-27T12:00:00.000Z");
    const organization = await prisma.organization.create({
      data: {
        name: "Stock Anomaly Test Organization",
      },
    });
    const otherOrganization = await prisma.organization.create({
      data: {
        name: "Other Stock Anomaly Test Organization",
      },
    });
    const defaultSettings = await getOrganizationSettings(organization.id);

    assert.equal(defaultSettings.anomalyOutThreshold, defaultAnomalyOutThreshold);

    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Stock Anomaly Test Clinic",
      },
    });
    const otherClinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Other Stock Anomaly Test Clinic",
      },
    });
    const otherOrganizationClinic = await prisma.clinic.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Organization Stock Anomaly Test Clinic",
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Stock Anomaly Test User",
        email: "stock-anomaly@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const otherUser = await prisma.user.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Stock Anomaly Test User",
        email: "other-stock-anomaly@example.test",
        passwordHash: "test-password-hash",
      },
    });
    const anomalousProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Anomalous Product",
        productCode: "ANM-001",
        category: "Consumables",
        defaultMinStock: 1,
      },
    });
    const normalProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Normal Product",
        defaultMinStock: 1,
      },
    });
    const lowBaselineProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Low Baseline Product",
        defaultMinStock: 1,
      },
    });
    const otherOrganizationProduct = await prisma.product.create({
      data: {
        organizationId: otherOrganization.id,
        name: "Other Organization Anomaly Product",
        defaultMinStock: 1,
      },
    });

    await prisma.organizationSetting.create({
      data: {
        organizationId: organization.id,
        anomalyOutThreshold: 3,
      },
    });

    await prisma.stockMovement.createMany({
      data: [
        {
          clinicId: clinic.id,
          productId: anomalousProduct.id,
          movementType: "OUT",
          quantity: 30,
          beforeQuantity: 100,
          afterQuantity: 70,
          userId: user.id,
          createdAt: new Date("2026-05-10T00:00:00.000Z"),
        },
        {
          clinicId: clinic.id,
          productId: anomalousProduct.id,
          movementType: "OUT",
          quantity: 4,
          beforeQuantity: 70,
          afterQuantity: 66,
          userId: user.id,
          createdAt: new Date("2026-05-27T10:00:00.000Z"),
        },
        {
          clinicId: clinic.id,
          productId: normalProduct.id,
          movementType: "OUT",
          quantity: 30,
          beforeQuantity: 100,
          afterQuantity: 70,
          userId: user.id,
          createdAt: new Date("2026-05-10T00:00:00.000Z"),
        },
        {
          clinicId: clinic.id,
          productId: normalProduct.id,
          movementType: "OUT",
          quantity: 2,
          beforeQuantity: 70,
          afterQuantity: 68,
          userId: user.id,
          createdAt: new Date("2026-05-27T10:00:00.000Z"),
        },
        {
          clinicId: clinic.id,
          productId: lowBaselineProduct.id,
          movementType: "OUT",
          quantity: 1,
          beforeQuantity: 100,
          afterQuantity: 99,
          userId: user.id,
          createdAt: new Date("2026-05-10T00:00:00.000Z"),
        },
        {
          clinicId: clinic.id,
          productId: lowBaselineProduct.id,
          movementType: "OUT",
          quantity: 10,
          beforeQuantity: 99,
          afterQuantity: 89,
          userId: user.id,
          createdAt: new Date("2026-05-27T10:00:00.000Z"),
        },
        {
          clinicId: otherClinic.id,
          productId: anomalousProduct.id,
          movementType: "OUT",
          quantity: 99,
          beforeQuantity: 99,
          afterQuantity: 0,
          userId: user.id,
          createdAt: new Date("2026-05-27T10:00:00.000Z"),
        },
        {
          clinicId: otherOrganizationClinic.id,
          productId: otherOrganizationProduct.id,
          movementType: "OUT",
          quantity: 30,
          beforeQuantity: 100,
          afterQuantity: 70,
          userId: otherUser.id,
          createdAt: new Date("2026-05-10T00:00:00.000Z"),
        },
        {
          clinicId: otherOrganizationClinic.id,
          productId: otherOrganizationProduct.id,
          movementType: "OUT",
          quantity: 99,
          beforeQuantity: 70,
          afterQuantity: 0,
          userId: otherUser.id,
          createdAt: new Date("2026-05-27T10:00:00.000Z"),
        },
      ],
    });

    const anomalies = await getStockAnomalies(organization.id, clinic.id, {
      now,
    });

    assert.equal(anomalies.length, 1);
    assert.equal(anomalies[0]?.productId, anomalousProduct.id);
    assert.equal(anomalies[0]?.todayQuantity, 4);
    assert.equal(anomalies[0]?.baselineDaily, 1);
    assert.equal(anomalies[0]?.ratio, 4);
    assert.deepEqual(anomalies[0]?.operatorNames, ["Stock Anomaly Test User"]);

    console.log("stock-anomalies tests passed");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
