import { prisma } from "@/lib/db/prisma";
import { getOrderRequestStatusCounts } from "@/lib/db/orders";

export type StockRow = {
  stockItemId: string;
  productId: string;
  productCode: string | null;
  janCode: string | null;
  name: string;
  category: string | null;
  manufacturer: string | null;
  orderUnit: string | null;
  supplierId: string | null;
  supplierName: string | null;
  quantity: number;
  minStock: number;
  shortageCount: number;
  location: string | null;
  photoFileName: string | null;
  photoUpdatedAt: number | null;
};

export function toStockRow(item: {
  id: string;
  productId: string;
  quantity: number;
  minStock: number | null;
  location: string | null;
  product: {
    productCode: string | null;
    janCode: string | null;
    name: string;
    category: string | null;
    manufacturer: string | null;
    orderUnit: string | null;
    defaultMinStock: number;
    photoFileName: string | null;
    photoUpdatedAt: Date | null;
    primarySupplier: {
      id: string;
      name: string;
    } | null;
  };
}): StockRow {
  const minStock = item.minStock ?? item.product.defaultMinStock;

  return {
    stockItemId: item.id,
    productId: item.productId,
    productCode: item.product.productCode,
    janCode: item.product.janCode,
    name: item.product.name,
    category: item.product.category,
    manufacturer: item.product.manufacturer,
    orderUnit: item.product.orderUnit,
    supplierId: item.product.primarySupplier?.id ?? null,
    supplierName: item.product.primarySupplier?.name ?? null,
    quantity: item.quantity,
    minStock,
    shortageCount: Math.max(0, minStock - item.quantity),
    location: item.location,
    photoFileName: item.product.photoFileName,
    photoUpdatedAt: item.product.photoUpdatedAt?.getTime() ?? null,
  };
}

export async function getStockRows(clinicId: string) {
  const items = await prisma.stockItem.findMany({
    where: {
      clinicId,
      isUsed: true,
      product: {
        isActive: true,
      },
    },
    include: {
      product: {
        include: {
          primarySupplier: true,
        },
      },
    },
    orderBy: [
      {
        product: {
          category: "asc",
        },
      },
      {
        product: {
          name: "asc",
        },
      },
    ],
  });

  return items.map(toStockRow);
}

export async function countShortageItems(clinicId: string) {
  const rows = await getStockRows(clinicId);

  return rows.filter((row) => row.quantity <= row.minStock).length;
}

export async function getHomeStockSummary(clinicId: string) {
  const [rows, favoriteCardCount, orderRequestStatusCounts, latestMovement] = await Promise.all([
    getStockRows(clinicId),
    prisma.favoriteProductCard.count({
      where: {
        clinicId,
      },
    }),
    getOrderRequestStatusCounts(clinicId),
    prisma.stockMovement.findFirst({
      where: {
        clinicId,
      },
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);
  const shortageCount = rows.filter((row) => row.quantity <= row.minStock).length;
  const zeroStockCount = rows.filter((row) => row.quantity === 0).length;
  const totalQuantity = rows.reduce((total, row) => total + row.quantity, 0);

  return {
    stockItemCount: rows.length,
    shortageCount,
    zeroStockCount,
    totalQuantity,
    favoriteCardCount,
    draftOrderRequestCount: orderRequestStatusCounts.DRAFT,
    orderRequestStatusCounts,
    latestMovement: latestMovement
      ? {
          productName: latestMovement.product.name,
          movementType: latestMovement.movementType,
          beforeQuantity: latestMovement.beforeQuantity,
          afterQuantity: latestMovement.afterQuantity,
          createdAt: latestMovement.createdAt,
        }
      : null,
  };
}

export async function getCategories(clinicId: string) {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      stockItems: {
        some: {
          clinicId,
          isUsed: true,
        },
      },
    },
    select: {
      category: true,
    },
    distinct: ["category"],
    orderBy: {
      category: "asc",
    },
  });

  return products
    .map((product) => product.category)
    .filter((category): category is string => Boolean(category));
}
