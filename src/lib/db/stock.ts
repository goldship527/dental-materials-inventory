import { prisma } from "@/lib/db/prisma";
import { getOrderRequestStatusCounts } from "@/lib/db/orders";
import { getStockStatus, type StockStatusKey } from "@/lib/stock/status";

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
  stockUsageMode: string;
  quantity: number;
  inUseQuantity: number;
  discardedQuantity: number;
  totalQuantity: number;
  stockUpdatedAt: number;
  minStock: number;
  shortageCount: number;
  stockStatus: StockStatusKey;
  stockStatusLabel: string;
  stockStatusClassName: string;
  isShortage: boolean;
  isAtMin: boolean;
  location: string | null;
  photoFileName: string | null;
  photoUpdatedAt: number | null;
};

export function toStockRow(item: {
  id: string;
  productId: string;
  quantity: number;
  inUseQuantity: number;
  discardedQuantity: number;
  updatedAt: Date;
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
    stockUsageMode: string;
    photoFileName: string | null;
    photoUpdatedAt: Date | null;
    primarySupplier: {
      id: string;
      name: string;
    } | null;
  };
}): StockRow {
  const minStock = item.minStock ?? item.product.defaultMinStock;
  const status = getStockStatus(item.quantity, minStock);

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
    stockUsageMode: item.product.stockUsageMode,
    quantity: item.quantity,
    inUseQuantity: item.inUseQuantity,
    discardedQuantity: item.discardedQuantity,
    totalQuantity: item.quantity + item.inUseQuantity,
    stockUpdatedAt: item.updatedAt.getTime(),
    minStock,
    shortageCount: status.shortageCount,
    stockStatus: status.key,
    stockStatusLabel: status.label,
    stockStatusClassName: status.badgeClassName,
    isShortage: status.isShortage,
    isAtMin: status.isAtMin,
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

  return rows.filter((row) => row.isShortage).length;
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
  const shortageCount = rows.filter((row) => row.isShortage).length;
  const zeroStockCount = rows.filter((row) => row.quantity === 0).length;
  const atMinStockCount = rows.filter((row) => row.isAtMin).length;
  const totalQuantity = rows.reduce((total, row) => total + row.quantity, 0);

  return {
    stockItemCount: rows.length,
    shortageCount,
    zeroStockCount,
    atMinStockCount,
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
