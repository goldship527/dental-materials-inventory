import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { resetTestDatabase } from "./helpers/db";

async function buildEan13(prefix12: string) {
  const { calculateEan13CheckDigit } = await import("../src/lib/barcode/ean13");
  const checkDigit = calculateEan13CheckDigit(prefix12);

  if (!checkDigit) {
    throw new Error("Invalid EAN prefix");
  }

  return `${prefix12}${checkDigit}`;
}

async function seedBase(prisma: PrismaClient) {
  const organization = await prisma.organization.create({
    data: {
      name: "Batch Stock Out Organization",
    },
  });
  const clinic = await prisma.clinic.create({
    data: {
      organizationId: organization.id,
      name: "Batch Stock Out Clinic",
    },
  });
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: "Batch Stock Out User",
      email: "batch-stock-out@example.test",
      passwordHash: "test-password-hash",
    },
  });

  await prisma.userClinicAssignment.create({
    data: {
      userId: user.id,
      clinicId: clinic.id,
    },
  });

  const staffOperator = await prisma.staffOperator.create({
    data: {
      organizationId: organization.id,
      displayName: "Batch Stock Out Staff",
      barcode: "STAFF-BATCH-OUT",
      clinicAssignments: {
        create: {
          clinicId: clinic.id,
        },
      },
    },
  });
  const context = {
    userId: user.id,
    userName: user.name,
    organizationId: organization.id,
    clinicId: clinic.id,
    clinicName: clinic.name,
  };

  return {
    organization,
    clinic,
    user,
    staffOperator,
    context,
  };
}

async function createStockProduct(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    clinicId: string;
    name: string;
    janCode: string;
    quantity: number;
  },
) {
  const product = await prisma.product.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      productCode: input.name.toUpperCase().replace(/\s+/g, "-"),
      janCode: input.janCode,
      defaultMinStock: 1,
    },
  });

  await prisma.stockItem.create({
    data: {
      clinicId: input.clinicId,
      productId: product.id,
      quantity: input.quantity,
      minStock: 1,
    },
  });

  return product;
}

async function getQuantity(prisma: PrismaClient, clinicId: string, productId: string) {
  const stockItem = await prisma.stockItem.findUniqueOrThrow({
    where: {
      clinicId_productId: {
        clinicId,
        productId,
      },
    },
  });

  return stockItem.quantity;
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { batchStockOutForContext, resolveBatchScanForContext } = await import("../src/lib/actions/barcode-batch");

  try {
    const base = await seedBase(prisma);
    const productA = await createStockProduct(prisma, {
      organizationId: base.organization.id,
      clinicId: base.clinic.id,
      name: "Batch Out Product A",
      janCode: await buildEan13("491000000001"),
      quantity: 5,
    });
    const productB = await createStockProduct(prisma, {
      organizationId: base.organization.id,
      clinicId: base.clinic.id,
      name: "Batch Out Product B",
      janCode: await buildEan13("491000000002"),
      quantity: 3,
    });

    const staffResolution = await resolveBatchScanForContext(base.context, {
      mode: "OUT",
      barcode: base.staffOperator.barcode,
    });

    assert.equal(staffResolution.kind, "staff");
    if (staffResolution.kind === "staff") {
      assert.equal(staffResolution.staffOperatorId, base.staffOperator.id);
    }

    const productResolution = await resolveBatchScanForContext(base.context, {
      mode: "OUT",
      barcode: productA.janCode!,
    });

    assert.equal(productResolution.kind, "product");
    if (productResolution.kind === "product") {
      assert.equal(productResolution.status, "stock-out-ready");
      assert.equal(productResolution.productId, productA.id);
    }

    const result = await batchStockOutForContext(base.context, {
      staffOperatorId: base.staffOperator.id,
      reason: "使用",
      reasonNote: "Batch",
      lines: [
        {
          productId: productA.id,
          barcode: productA.janCode!,
          quantity: 2,
        },
        {
          productId: productB.id,
          barcode: productB.janCode!,
          quantity: 1,
        },
      ],
      revalidate: false,
    });

    assert.equal(result.status, "success");
    assert.equal(result.processedCount, 2);
    assert.equal(await getQuantity(prisma, base.clinic.id, productA.id), 3);
    assert.equal(await getQuantity(prisma, base.clinic.id, productB.id), 2);
    assert.equal(
      await prisma.stockMovement.count({
        where: {
          clinicId: base.clinic.id,
          sourceType: "BARCODE_STOCK",
          performedByStaffId: base.staffOperator.id,
          reason: "使用: Batch",
        },
      }),
      2,
    );

    await assert.rejects(() =>
      batchStockOutForContext(base.context, {
        staffOperatorId: base.staffOperator.id,
        reason: "使用",
        reasonNote: "",
        lines: [
          {
            productId: productA.id,
            barcode: productA.janCode!,
            quantity: 99,
          },
          {
            productId: productB.id,
            barcode: productB.janCode!,
            quantity: 1,
          },
        ],
        revalidate: false,
      }),
    );

    assert.equal(await getQuantity(prisma, base.clinic.id, productA.id), 3);
    assert.equal(await getQuantity(prisma, base.clinic.id, productB.id), 2);

    const skipResult = await batchStockOutForContext(base.context, {
      staffOperatorId: base.staffOperator.id,
      reason: "使用",
      reasonNote: "",
      lines: [
        {
          productId: productA.id,
          barcode: productA.janCode!,
          quantity: 99,
        },
        {
          productId: productB.id,
          barcode: productB.janCode!,
          quantity: 1,
        },
      ],
      skipShortageLines: true,
      revalidate: false,
    });

    assert.equal(skipResult.status, "success");
    assert.equal(skipResult.processedCount, 1);
    assert.equal(skipResult.skippedCount, 1);
    assert.equal(await getQuantity(prisma, base.clinic.id, productA.id), 3);
    assert.equal(await getQuantity(prisma, base.clinic.id, productB.id), 1);

    await assert.rejects(() =>
      batchStockOutForContext(base.context, {
        staffOperatorId: "missing-staff",
        reason: "使用",
        reasonNote: "",
        lines: [
          {
            productId: productA.id,
            barcode: productA.janCode!,
            quantity: 1,
          },
        ],
        revalidate: false,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
