import { prisma } from "@/lib/db/prisma";
import { getOrderRequestStatusCounts } from "@/lib/db/orders";
import { getStockStatus, type StockStatusKey } from "@/lib/stock/status";

const defaultStockPageSize = 50;
const maxStockPageSize = 200;

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

export type StockPageParams = {
  q?: string;
  category?: string;
  shortageOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export type StockPageResult = {
  rows: StockRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function normalizePageInput(page: number | undefined, pageSize: number | undefined) {
  const normalizedPage = page && Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const normalizedPageSize =
    pageSize && Number.isFinite(pageSize) && pageSize > 0
      ? Math.min(Math.floor(pageSize), maxStockPageSize)
      : defaultStockPageSize;

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
  };
}

function getStockPageSlice<T>(rows: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;

  return rows.slice(start, start + pageSize);
}

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
      {
        id: "asc",
      },
    ],
  });

  return items.map(toStockRow);
}

export async function getStockPage(clinicId: string, params: StockPageParams = {}): Promise<StockPageResult> {
  const { page, pageSize } = normalizePageInput(params.page, params.pageSize);
  const query = params.q?.trim();
  const where = {
    clinicId,
    isUsed: true,
    product: {
      isActive: true,
      ...(params.category ? { category: params.category } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { productCode: { contains: query, mode: "insensitive" as const } },
              { janCode: { contains: query, mode: "insensitive" as const } },
              { category: { contains: query, mode: "insensitive" as const } },
              { manufacturer: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
  };
  const orderBy = [
    {
      product: {
        category: "asc" as const,
      },
    },
    {
      product: {
        name: "asc" as const,
      },
    },
    {
      id: "asc" as const,
    },
  ];

  if (params.shortageOnly) {
    const items = await prisma.stockItem.findMany({
      where,
      include: {
        product: {
          include: {
            primarySupplier: true,
          },
        },
      },
      orderBy,
    });
    const filteredRows = items.map(toStockRow).filter((row) => row.isShortage);
    const total = filteredRows.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    return {
      rows: getStockPageSlice(filteredRows, page, pageSize),
      total,
      page,
      pageSize,
      pageCount,
    };
  }

  const [total, items] = await Promise.all([
    prisma.stockItem.count({
      where,
    }),
    prisma.stockItem.findMany({
      where,
      include: {
        product: {
          include: {
            primarySupplier: true,
          },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return {
    rows: items.map(toStockRow),
    total,
    page,
    pageSize,
    pageCount,
  };
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
