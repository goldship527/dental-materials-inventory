import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { getDashboardSummary } = await import("../src/lib/db/dashboard");
  const { getStockRows, countShortageItems } = await import("../src/lib/db/stock");
  const { getStockStatus } = await import("../src/lib/stock/status");

  try {
    const organization = await prisma.organization.create({
      data: {
        name: "Stock Status Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Stock Status Test Clinic",
        isActive: true,
      },
    });
    const products = await Promise.all(
      [
        ["Zero And Shortage", 0, 5],
        ["Shortage", 4, 5],
        ["At Minimum", 5, 5],
        ["Enough", 6, 5],
        ["Zero But No Minimum", 0, 0],
      ].map(([name, quantity, minStock]) =>
        prisma.product.create({
          data: {
            organizationId: organization.id,
            name: String(name),
            defaultMinStock: Number(minStock),
            stockItems: {
              create: {
                clinicId: clinic.id,
                quantity: Number(quantity),
                minStock: Number(minStock),
                isUsed: true,
              },
            },
          },
        }),
      ),
    );

    assert.equal(products.length, 5);
    assert.equal(getStockStatus(0, 5).label, "在庫切れ");
    assert.equal(getStockStatus(4, 5).label, "不足");
    assert.equal(getStockStatus(5, 5).label, "ぎりぎり");
    assert.equal(getStockStatus(6, 5).label, "十分");
    assert.equal(getStockStatus(0, 0).label, "在庫切れ");
    assert.equal(getStockStatus(0, 0).isShortage, false);

    const rows = await getStockRows(clinic.id);
    const summary = await getDashboardSummary(clinic.id);

    assert.equal(rows.filter((row) => row.isShortage).length, 2);
    assert.equal(await countShortageItems(clinic.id), 2);
    assert.equal(summary.shortageCount, 2);
    assert.equal(summary.zeroStockCount, 2);
    assert.equal(summary.atMinStockCount, 1);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
