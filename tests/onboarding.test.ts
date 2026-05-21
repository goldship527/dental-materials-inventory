import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { resetTestDatabase } from "./helpers/db";

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const { buildOnboardingSteps, getOnboardingSummary } = await import("../src/lib/db/onboarding");

  try {
    const organization = await prisma.organization.create({
      data: {
        name: "Onboarding Test Organization",
      },
    });
    const clinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: "Onboarding Test Clinic",
        isActive: true,
      },
    });
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: "Onboarding User",
        email: "onboarding-user@example.test",
        passwordHash: await bcrypt.hash("Onboarding123!", 12),
        role: "ADMIN",
        isActive: true,
      },
    });
    const supplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: "Onboarding Supplier",
      },
    });
    const readyProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Ready Product",
        janCode: "4900000000001",
        primarySupplierId: supplier.id,
        defaultMinStock: 3,
        stockItems: {
          create: {
            clinicId: clinic.id,
            quantity: 5,
            minStock: 3,
            isUsed: true,
          },
        },
      },
    });

    await prisma.product.create({
      data: {
        organizationId: organization.id,
        name: "Needs Setup Product",
        defaultMinStock: 0,
      },
    });
    await prisma.userClinicAssignment.create({
      data: {
        userId: user.id,
        clinicId: clinic.id,
      },
    });
    await prisma.barcodeScanLog.create({
      data: {
        clinicId: clinic.id,
        userId: user.id,
        productId: readyProduct.id,
        rawInput: "UNRESOLVED",
        matchType: "NO_MATCH",
        resolveStatus: "UNRESOLVED",
      },
    });

    const summary = await getOnboardingSummary(organization.id, clinic.id);
    const steps = buildOnboardingSteps(summary);

    assert.equal(summary.productCount, 2);
    assert.equal(summary.supplierCount, 1);
    assert.equal(summary.productsWithSupplierCount, 1);
    assert.equal(summary.productsWithBarcodeCount, 1);
    assert.equal(summary.productsWithStockItemCount, 1);
    assert.equal(summary.productsWithMinStockCount, 1);
    assert.equal(summary.missingSupplierCount, 1);
    assert.equal(summary.missingBarcodeCount, 1);
    assert.equal(summary.missingStockItemCount, 1);
    assert.equal(summary.missingMinStockCount, 1);
    assert.equal(summary.unresolvedBarcodeScanCount, 1);
    assert.equal(steps.find((step) => step.id === "products")?.status, "done");
    assert.equal(steps.find((step) => step.id === "product-suppliers")?.status, "attention");
    assert.equal(steps.find((step) => step.id === "barcodes")?.href, "/barcode/scans/unresolved");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
