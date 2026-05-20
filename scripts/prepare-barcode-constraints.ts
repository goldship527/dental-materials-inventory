import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CountRow = {
  organizationId: string;
  value: string;
  count: bigint;
};

type ConflictRow = {
  organizationId: string;
  barcode: string;
  barcodeProductId: string;
  janProductId: string;
};

type ColumnExistsRow = {
  exists: boolean;
};

function formatCountRows(rows: CountRow[]) {
  return rows
    .map((row) => `organizationId=${row.organizationId}, value=${row.value}, count=${row.count.toString()}`)
    .join("\n");
}

function formatConflictRows(rows: ConflictRow[]) {
  return rows
    .map(
      (row) =>
        `organizationId=${row.organizationId}, barcode=${row.barcode}, barcodeProductId=${row.barcodeProductId}, janProductId=${row.janProductId}`,
    )
    .join("\n");
}

async function assertNoDuplicateProductJanCodes() {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT "organizationId", "janCode" AS value, COUNT(*)::bigint AS count
    FROM "Product"
    WHERE "janCode" IS NOT NULL
    GROUP BY "organizationId", "janCode"
    HAVING COUNT(*) > 1
  `;

  if (rows.length > 0) {
    throw new Error(`Duplicate Product.janCode values exist within an organization:\n${formatCountRows(rows)}`);
  }
}

async function assertNoDuplicateProductBarcodes() {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT p."organizationId", pb."barcode" AS value, COUNT(*)::bigint AS count
    FROM "ProductBarcode" pb
    INNER JOIN "Product" p ON p."id" = pb."productId"
    GROUP BY p."organizationId", pb."barcode"
    HAVING COUNT(*) > 1
  `;

  if (rows.length > 0) {
    throw new Error(`Duplicate ProductBarcode.barcode values exist within an organization:\n${formatCountRows(rows)}`);
  }
}

async function assertNoBarcodeJanConflicts() {
  const rows = await prisma.$queryRaw<ConflictRow[]>`
    SELECT
      barcode_product."organizationId",
      pb."barcode",
      pb."productId" AS "barcodeProductId",
      jan_product."id" AS "janProductId"
    FROM "ProductBarcode" pb
    INNER JOIN "Product" barcode_product ON barcode_product."id" = pb."productId"
    INNER JOIN "Product" jan_product
      ON jan_product."organizationId" = barcode_product."organizationId"
      AND jan_product."janCode" = pb."barcode"
      AND jan_product."id" <> pb."productId"
    WHERE jan_product."janCode" IS NOT NULL
  `;

  if (rows.length > 0) {
    throw new Error(
      `ProductBarcode.barcode values conflict with another product's Product.janCode:\n${formatConflictRows(rows)}`,
    );
  }
}

async function ensureProductBarcodeOrganizationIdColumn() {
  const rows = await prisma.$queryRaw<ColumnExistsRow[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ProductBarcode'
        AND column_name = 'organizationId'
    ) AS "exists"
  `;
  const exists = rows[0]?.exists ?? false;

  if (!exists) {
    await prisma.$executeRaw`
      ALTER TABLE "ProductBarcode" ADD COLUMN "organizationId" TEXT
    `;
  }

  await prisma.$executeRaw`
    UPDATE "ProductBarcode" pb
    SET "organizationId" = p."organizationId"
    FROM "Product" p
    WHERE p."id" = pb."productId"
      AND (pb."organizationId" IS NULL OR pb."organizationId" <> p."organizationId")
  `;

  const missingRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "ProductBarcode"
    WHERE "organizationId" IS NULL
  `;
  const missingCount = missingRows[0]?.count ?? 0n;

  if (missingCount > 0n) {
    throw new Error(`ProductBarcode.organizationId could not be backfilled for ${missingCount.toString()} rows.`);
  }

  await prisma.$executeRaw`
    ALTER TABLE "ProductBarcode" ALTER COLUMN "organizationId" SET NOT NULL
  `;
}

async function ensureUniqueIndexes() {
  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "Product_organizationId_janCode_key"
    ON "Product" ("organizationId", "janCode")
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "ProductBarcode_organizationId_barcode_key"
    ON "ProductBarcode" ("organizationId", "barcode")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "ProductBarcode_organizationId_idx"
    ON "ProductBarcode" ("organizationId")
  `;
}

async function main() {
  await assertNoDuplicateProductJanCodes();
  await assertNoDuplicateProductBarcodes();
  await assertNoBarcodeJanConflicts();
  await ensureProductBarcodeOrganizationIdColumn();
  await ensureUniqueIndexes();

  console.log("Barcode constraint preparation completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
