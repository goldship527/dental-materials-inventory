const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      janCode: {
        not: null,
      },
    },
    select: {
      id: true,
      janCode: true,
      orderUnit: true,
      organizationId: true,
    },
  });
  let created = 0;

  for (const product of products) {
    if (!product.janCode) {
      continue;
    }

    const existing = await prisma.productBarcode.findFirst({
      where: {
        productId: product.id,
        barcode: product.janCode,
      },
    });

    if (existing) {
      continue;
    }

    await prisma.productBarcode.create({
      data: {
        organizationId: product.organizationId,
        productId: product.id,
        barcode: product.janCode,
        barcodeType: "JAN",
        unitLabel: product.orderUnit,
        isPrimary: true,
      },
    });
    created += 1;
  }

  console.log(`Backfilled ${created} product barcodes`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
