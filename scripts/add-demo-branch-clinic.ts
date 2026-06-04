import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const organizationName = "テスト法人";
const branchClinicName = "テスト分院";
const branchStaffName = "テスト分院スタッフ";
const branchStaffBarcode = "STAFF-0002";

function branchQuantityFor(index: number, minStock: number) {
  if (index < 3) {
    return 0;
  }

  if (index < 8) {
    return Math.max(1, minStock - 1);
  }

  return minStock + 1 + ((index * 5) % 6);
}

async function main() {
  const organization = await prisma.organization.findFirst({
    where: {
      name: organizationName,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!organization) {
    throw new Error(`${organizationName} が見つかりません。先に通常の開発DBを用意してください。`);
  }

  let branchClinic = await prisma.clinic.findFirst({
    where: {
      organizationId: organization.id,
      name: branchClinicName,
    },
    select: {
      id: true,
      name: true,
    },
  });

  let createdClinic = false;

  if (!branchClinic) {
    branchClinic = await prisma.clinic.create({
      data: {
        organizationId: organization.id,
        name: branchClinicName,
        address: "開発用の架空住所 分院",
        phone: "000-0000-0001",
      },
      select: {
        id: true,
        name: true,
      },
    });
    createdClinic = true;
  }

  const activeUsers = await prisma.user.findMany({
    where: {
      organizationId: organization.id,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
    },
    orderBy: {
      email: "asc",
    },
  });

  let createdUserAssignments = 0;

  for (const user of activeUsers) {
    await prisma.userClinicAssignment.upsert({
      where: {
        userId_clinicId: {
          userId: user.id,
          clinicId: branchClinic.id,
        },
      },
      create: {
        userId: user.id,
        clinicId: branchClinic.id,
      },
      update: {},
    });
    createdUserAssignments += 1;
  }

  const staffOperator = await prisma.staffOperator.upsert({
    where: {
      organizationId_barcode: {
        organizationId: organization.id,
        barcode: branchStaffBarcode,
      },
    },
    create: {
      organizationId: organization.id,
      displayName: branchStaffName,
      barcode: branchStaffBarcode,
      operatorType: "REGULAR",
      isActive: true,
    },
    update: {
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  await prisma.staffOperatorClinicAssignment.upsert({
    where: {
      staffOperatorId_clinicId: {
        staffOperatorId: staffOperator.id,
        clinicId: branchClinic.id,
      },
    },
    create: {
      staffOperatorId: staffOperator.id,
      clinicId: branchClinic.id,
    },
    update: {},
  });

  const products = await prisma.product.findMany({
    where: {
      organizationId: organization.id,
      isActive: true,
    },
    select: {
      id: true,
      category: true,
      defaultMinStock: true,
      productCode: true,
    },
    orderBy: [
      {
        productCode: "asc",
      },
      {
        name: "asc",
      },
    ],
  });

  let createdStockItems = 0;

  for (const [index, product] of products.entries()) {
    const existingStockItem = await prisma.stockItem.findUnique({
      where: {
        clinicId_productId: {
          clinicId: branchClinic.id,
          productId: product.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingStockItem) {
      continue;
    }

    await prisma.stockItem.create({
      data: {
        clinicId: branchClinic.id,
        productId: product.id,
        quantity: branchQuantityFor(index, product.defaultMinStock),
        minStock: index % 5 === 0 ? product.defaultMinStock + 2 : null,
        location: `分院棚-${(index % 6) + 1}`,
        isUsed: true,
      },
    });
    createdStockItems += 1;
  }

  let upsertedFavoriteCards = 0;

  for (const [index, product] of products.slice(0, 12).entries()) {
    await prisma.favoriteProductCard.upsert({
      where: {
        clinicId_productId: {
          clinicId: branchClinic.id,
          productId: product.id,
        },
      },
      create: {
        clinicId: branchClinic.id,
        productId: product.id,
        displayOrder: index + 1,
        categoryTab: product.category,
      },
      update: {},
    });
    upsertedFavoriteCards += 1;
  }

  const clinicCount = await prisma.clinic.count({
    where: {
      organizationId: organization.id,
      isActive: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        organization: organization.name,
        branchClinic: branchClinic.name,
        createdClinic,
        activeClinicCount: clinicCount,
        activeUsersAssigned: createdUserAssignments,
        staffBarcode: branchStaffBarcode,
        productsFound: products.length,
        stockItemsCreated: createdStockItems,
        favoriteCardsEnsured: upsertedFavoriteCards,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
