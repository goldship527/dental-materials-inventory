import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const where = {
    importSource: null,
    OR: [
      {
        notes: {
          contains: "[purchase-history-import]",
        },
      },
      {
        notes: {
          contains: "購入履歴から登録",
        },
      },
    ],
  };
  const targetCount = await prisma.product.count({
    where,
  });

  if (isDryRun) {
    console.log(`Dry run: ${targetCount} product(s) would be marked as PURCHASE_HISTORY.`);
    return;
  }

  const result = await prisma.product.updateMany({
    where,
    data: {
      importSource: "PURCHASE_HISTORY",
    },
  });

  console.log(`Backfilled Product.importSource for ${result.count} purchase-history product(s). Target count before update: ${targetCount}.`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
