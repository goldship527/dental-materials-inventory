import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { resetTestDatabase } from "./helpers/db";

async function seedTestData(prisma: PrismaClient) {
  const organization = await prisma.organization.create({
    data: {
      name: "Test Organization",
    },
  });
  const clinic = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Test Clinic",
    },
  });

  const product = await prisma.product.create({
    data: {
      organizationId: organization.id,
      productCode: "LOT-LIST-001",
      janCode: "4900000000016",
      name: "Lot List Product",
      category: "Test Category",
      manufacturer: "Test Manufacturer",
      defaultMinStock: 1,
    },
  });
  const inactiveProduct = await prisma.product.create({
    data: {
      organizationId: organization.id,
      productCode: "LOT-LIST-INACTIVE",
      name: "Inactive Product",
      isActive: false,
      defaultMinStock: 1,
    },
  });

  await prisma.stockLot.createMany({
    data: [
      {
        clinicId: clinic.id,
        productId: product.id,
        lotNumber: "EXPIRED",
        expiryDateText: "2026-05-20",
        expiryDate: new Date("2026-05-20T00:00:00.000Z"),
        quantity: 2,
      },
      {
        clinicId: clinic.id,
        productId: product.id,
        lotNumber: "SOON",
        expiryDateText: "2026-06-10",
        expiryDate: new Date("2026-06-10T00:00:00.000Z"),
        quantity: 3,
      },
      {
        clinicId: clinic.id,
        productId: product.id,
        lotNumber: "FUTURE",
        expiryDateText: "2026-08-01",
        expiryDate: new Date("2026-08-01T00:00:00.000Z"),
        quantity: 4,
      },
      {
        clinicId: clinic.id,
        productId: product.id,
        lotNumber: "NO-DATE",
        expiryDateText: "",
        expiryDate: null,
        quantity: 5,
      },
      {
        clinicId: clinic.id,
        productId: product.id,
        lotNumber: "ZERO",
        expiryDateText: "2026-05-25",
        expiryDate: new Date("2026-05-25T00:00:00.000Z"),
        quantity: 0,
      },
      {
        clinicId: clinic.id,
        productId: inactiveProduct.id,
        lotNumber: "INACTIVE",
        expiryDateText: "2026-05-25",
        expiryDate: new Date("2026-05-25T00:00:00.000Z"),
        quantity: 1,
      },
    ],
  });

  return {
    clinic,
    product,
  };
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const {
    countAttentionStockLots,
    getStockLotExpiryStatus,
    getStockLotRows,
    isStockLotVisibleByFilter,
    normalizeStockLotFilter,
  } = await import("../src/lib/db/stock-lots");

  try {
    const data = await seedTestData(prisma);
    const today = new Date("2026-05-23T00:00:00.000Z");
    const rows = await getStockLotRows(data.clinic.id, {
      today,
    });

    assert.equal(rows.length, 4);
    assert.equal(await countAttentionStockLots(data.clinic.id, today), 2);

    const statusByLot = new Map(rows.map((row) => [row.lotNumber, row.status]));

    assert.equal(statusByLot.get("EXPIRED"), "expired");
    assert.equal(statusByLot.get("SOON"), "expiring");
    assert.equal(statusByLot.get("FUTURE"), "valid");
    assert.equal(statusByLot.get("NO-DATE"), "undated");

    const expired = rows.find((row) => row.lotNumber === "EXPIRED");
    const soon = rows.find((row) => row.lotNumber === "SOON");
    const future = rows.find((row) => row.lotNumber === "FUTURE");
    const noDate = rows.find((row) => row.lotNumber === "NO-DATE");

    assert.ok(expired);
    assert.ok(soon);
    assert.ok(future);
    assert.ok(noDate);
    assert.equal(expired.productId, data.product.id);
    assert.equal(soon.daysUntilExpiry, 18);
    assert.equal(noDate.daysUntilExpiry, null);

    assert.equal(isStockLotVisibleByFilter(expired.status, "attention"), true);
    assert.equal(isStockLotVisibleByFilter(soon.status, "attention"), true);
    assert.equal(isStockLotVisibleByFilter(future.status, "attention"), false);
    assert.equal(isStockLotVisibleByFilter(noDate.status, "all"), true);
    assert.equal(normalizeStockLotFilter("expired"), "expired");
    assert.equal(normalizeStockLotFilter("unknown"), "attention");

    assert.equal(getStockLotExpiryStatus(new Date("2026-06-22T00:00:00.000Z"), today).status, "expiring");
    assert.equal(getStockLotExpiryStatus(new Date("2026-06-23T00:00:00.000Z"), today).status, "valid");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
