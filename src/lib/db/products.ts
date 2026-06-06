import { prisma } from "@/lib/db/prisma";
import { getPendingOrderDetailsByProduct, getPendingOrdersByProduct, type PendingOrderSupplierSummary } from "@/lib/db/pending-orders";
import { getProductAbcRanks, type ProductAbcRankSummary } from "@/lib/db/product-abc-ranks";
import { getSupplierLeadTimes, type SupplierLeadTimeStats } from "@/lib/db/supplier-lead-times";
import type { OrderSendMethodValue } from "@/lib/orders/send-method";
import type { OrderRequestStatusValue } from "@/lib/orders/status";
import { normalizeDemoSpecification } from "@/lib/products/demo-specification";
import { isPurchaseHistoryImportSource, productImportSources } from "@/lib/products/import-source";
import {
  getRecommendedMinStocks,
  type RecommendedMinStocksByProduct,
  type RecommendedMinStockSummary,
} from "@/lib/stock/recommended-min-stock";

const defaultProductMasterPageSize = 50;
const maxProductMasterPageSize = 200;

export type ProductMasterRow = {
  id: string;
  productCode: string | null;
  janCode: string | null;
  internalCode: string | null;
  name: string;
  nameKana: string | null;
  category: string | null;
  manufacturer: string | null;
  specification: string | null;
  orderUnit: string | null;
  supplierId: string | null;
  supplierName: string | null;
  supplierProductCode: string | null;
  standardPrice: number | null;
  defaultMinStock: number;
  stockUsageMode: string;
  currentQuantity: number;
  inUseQuantity: number;
  discardedQuantity: number;
  totalQuantity: number;
  minStock: number;
  hasStockItem: boolean;
  stockItemId: string | null;
  location: string | null;
  photoFileName: string | null;
  photoMimeType: string | null;
  photoUpdatedAt: Date | null;
  importSource: string | null;
  notes: string | null;
  barcodes: ProductBarcodeSummary[];
  pendingOrders: ProductPendingOrderSummary;
  abcRank: ProductAbcRankSummary;
  recommendedMinStock: RecommendedMinStockSummary;
};

export type ProductBarcodeSummary = {
  id: string | null;
  barcode: string;
  barcodeType: string;
  unitLabel: string | null;
  isPrimary: boolean;
};

export type ProductSupplierOption = {
  id: string;
  name: string;
};

export type PurchaseHistorySetupProductRow = {
  id: string;
  name: string;
  productCode: string | null;
  janCode: string | null;
  category: string | null;
  manufacturer: string | null;
  specification: string | null;
  defaultMinStock: number;
  importSource: string | null;
  recommendedMinStock: RecommendedMinStockSummary | null;
};

export type PurchaseHistoryProductSummary = {
  total: number;
  needsSetup: number;
};

export type ProductDetail = ProductMasterRow & {
  primarySupplierId: string | null;
  productSuppliers: ProductSupplierSummary[];
  pendingOrderSuppliers: PendingOrderSupplierSummary[];
  stockLots: ProductStockLotSummary[];
  recentMovements: ProductDetailMovement[];
  orderRequests: ProductDetailOrderRequest[];
};

export type ProductPendingOrderSummary = {
  count: number;
  totalQuantity: number;
  latestOrderedAt: Date | null;
};

export type ProductMasterPageParams = {
  q?: string;
  category?: string;
  source?: string;
  setup?: string;
  page?: number;
  pageSize?: number;
};

export type ProductMasterPageResult = {
  rows: ProductMasterRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type ProductMasterSource = {
  id: string;
  productCode: string | null;
  janCode: string | null;
  internalCode: string | null;
  name: string;
  nameKana: string | null;
  category: string | null;
  manufacturer: string | null;
  specification: string | null;
  orderUnit: string | null;
  supplierProductCode: string | null;
  standardPrice: number | null;
  defaultMinStock: number;
  stockUsageMode: string;
  photoFileName: string | null;
  photoMimeType: string | null;
  photoUpdatedAt: Date | null;
  importSource: string | null;
  notes: string | null;
  primarySupplier: {
    id: string;
    name: string;
  } | null;
  stockItems: Array<{
    id: string;
    quantity: number;
    inUseQuantity: number;
    discardedQuantity: number;
    minStock: number | null;
    location: string | null;
  }>;
  barcodes: ProductBarcodeSummary[];
};

type ProductMasterSummaryMaps = {
  pendingOrdersByProduct: Record<string, ProductPendingOrderSummary>;
  abcRanksByProduct: Record<string, ProductAbcRankSummary>;
  recommendedMinStocksByProduct: RecommendedMinStocksByProduct;
};

export type ProductSupplierSummary = {
  id: string | null;
  supplierId: string;
  supplierName: string;
  supplierProductCode: string | null;
  orderUnit: string | null;
  standardPrice: number | null;
  isPrimary: boolean;
  isActive: boolean;
  notes: string | null;
  leadTime: SupplierLeadTimeStats | null;
};

export type ProductDetailMovement = {
  id: string;
  movementType: string;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  reason: string | null;
  memo: string | null;
  sourceType: string | null;
  lotNumber: string | null;
  expiryDateText: string | null;
  expiryDate: Date | null;
  userName: string;
  createdAt: Date;
};

export type ProductStockLotSummary = {
  id: string;
  lotNumber: string;
  expiryDateText: string;
  expiryDate: Date | null;
  quantity: number;
  updatedAt: Date;
};

export type ProductDetailOrderRequest = {
  id: string;
  status: OrderRequestStatusValue;
  requestedQuantity: number;
  memo: string | null;
  supplierId: string | null;
  orderRecordId: string | null;
  supplierName: string | null;
  orderedAt: Date | null;
  orderedMethod: OrderSendMethodValue | null;
  orderedMemo: string | null;
  supplierResponseMemo: string | null;
  receivedQuantity: number | null;
  receivedAt: Date | null;
  receivedMemo: string | null;
  receivedLotNumber: string | null;
  receivedExpiryDateText: string | null;
  receivedExpiryDate: Date | null;
  updatedAt: Date;
};

function normalizeProductMasterPageInput(page: number | undefined, pageSize: number | undefined) {
  const normalizedPage = page && Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const normalizedPageSize =
    pageSize && Number.isFinite(pageSize) && pageSize > 0
      ? Math.min(Math.floor(pageSize), maxProductMasterPageSize)
      : defaultProductMasterPageSize;

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
  };
}

function getProductMasterPageSlice<T>(rows: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;

  return rows.slice(start, start + pageSize);
}

function needsInitialProductMasterSetup(row: {
  category: string | null;
  hasStockItem: boolean;
  minStock: number;
  location: string | null;
}) {
  return !row.hasStockItem || !row.category || row.category === "未分類" || row.minStock === 0 || !row.location;
}

function productMatchesCurrentMasterFilters(row: ProductMasterRow, params: ProductMasterPageParams) {
  const query = params.q?.trim().toLowerCase() ?? "";
  const searchText = [
    row.name,
    row.nameKana,
    row.productCode,
    row.janCode,
    row.internalCode,
    row.category,
    row.manufacturer,
    row.specification,
    row.orderUnit,
    row.supplierName,
    row.supplierProductCode,
    row.notes,
    ...row.barcodes.map((barcode) => barcode.barcode),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const matchesQuery = query ? searchText.includes(query) : true;
  const matchesCategory = params.category ? row.category === params.category : true;
  const matchesSource =
    params.source === "purchase-history" ? isPurchaseHistoryImportSource(row.importSource) : true;
  const matchesSetup = params.setup === "1" ? needsInitialProductMasterSetup(row) : true;

  return matchesQuery && matchesCategory && matchesSource && matchesSetup;
}

function toProductMasterRow(product: ProductMasterSource, maps: ProductMasterSummaryMaps): ProductMasterRow {
  const stockItem = product.stockItems[0];
  const currentQuantity = stockItem?.quantity ?? 0;
  const inUseQuantity = stockItem?.inUseQuantity ?? 0;
  const discardedQuantity = stockItem?.discardedQuantity ?? 0;
  const minStock = stockItem?.minStock ?? product.defaultMinStock;
  const barcodes =
    product.barcodes.length > 0
      ? product.barcodes
      : product.janCode
        ? [
            {
              id: null,
              barcode: product.janCode,
              barcodeType: "JAN",
              unitLabel: product.orderUnit,
              isPrimary: true,
            },
          ]
        : [];

  return {
    id: product.id,
    productCode: product.productCode,
    janCode: product.janCode,
    internalCode: product.internalCode,
    name: product.name,
    nameKana: product.nameKana,
    category: product.category,
    manufacturer: product.manufacturer,
    specification: normalizeDemoSpecification(product.specification, product.name, product.orderUnit),
    orderUnit: product.orderUnit,
    supplierId: product.primarySupplier?.id ?? null,
    supplierName: product.primarySupplier?.name ?? null,
    supplierProductCode: product.supplierProductCode,
    standardPrice: product.standardPrice,
    defaultMinStock: product.defaultMinStock,
    stockUsageMode: product.stockUsageMode,
    currentQuantity,
    inUseQuantity,
    discardedQuantity,
    totalQuantity: currentQuantity + inUseQuantity,
    minStock,
    hasStockItem: Boolean(stockItem),
    stockItemId: stockItem?.id ?? null,
    location: stockItem?.location ?? null,
    photoFileName: product.photoFileName,
    photoMimeType: product.photoMimeType,
    photoUpdatedAt: product.photoUpdatedAt,
    importSource: product.importSource,
    notes: product.notes,
    barcodes,
    pendingOrders: maps.pendingOrdersByProduct[product.id] ?? {
      count: 0,
      totalQuantity: 0,
      latestOrderedAt: null,
    },
    abcRank: maps.abcRanksByProduct[product.id] ?? {
      rank: "UNUSED",
      totalQuantity: 0,
      share: 0,
    },
    recommendedMinStock: maps.recommendedMinStocksByProduct[product.id] ?? {
      recommended: null,
      totalOut90d: 0,
      monthlyUsage: 0,
      leadDays: 7,
      safetyFactor: 1.5,
      sampleSufficient: false,
      usesFallbackLeadTime: true,
      leadTimeSampleCount: null,
    },
  };
}

export async function getProductSupplierOptions(organizationId: string): Promise<ProductSupplierOption[]> {
  return prisma.supplier.findMany({
    where: {
      organizationId,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function getProductCategories(organizationId: string): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      isActive: true,
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

export async function getPurchaseHistorySetupProductRows(
  organizationId: string,
  options: { clinicId?: string; take?: number } | number = 200,
): Promise<PurchaseHistorySetupProductRow[]> {
  const take = typeof options === "number" ? options : (options.take ?? 200);
  const clinicId = typeof options === "number" ? undefined : options.clinicId;
  const [products, recommendedMinStocksByProduct] = await Promise.all([
    prisma.product.findMany({
    where: {
      organizationId,
      isActive: true,
      importSource: productImportSources.purchaseHistory,
      AND: [
        {
          OR: [
            {
              category: null,
            },
            {
              category: "",
            },
            {
              category: "未分類",
            },
            {
              defaultMinStock: 0,
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      productCode: true,
      janCode: true,
      category: true,
      manufacturer: true,
      specification: true,
      defaultMinStock: true,
      importSource: true,
    },
    orderBy: [
      {
        category: "asc",
      },
      {
        name: "asc",
      },
      {
        id: "asc",
      },
    ],
    take,
    }),
    clinicId ? getRecommendedMinStocks(organizationId, clinicId) : Promise.resolve({} as RecommendedMinStocksByProduct),
  ]);

  return products.map((product) => ({
    ...product,
    recommendedMinStock: recommendedMinStocksByProduct[product.id] ?? null,
  }));
}

export async function getPurchaseHistoryProductSummary(
  organizationId: string,
  clinicId: string,
): Promise<PurchaseHistoryProductSummary> {
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      isActive: true,
      importSource: productImportSources.purchaseHistory,
    },
    select: {
      category: true,
      defaultMinStock: true,
      stockItems: {
        where: {
          clinicId,
          isUsed: true,
        },
        select: {
          minStock: true,
          location: true,
        },
      },
    },
  });

  return {
    total: products.length,
    needsSetup: products.filter((product) => {
      const stockItem = product.stockItems[0];

      return needsInitialProductMasterSetup({
        category: product.category,
        hasStockItem: Boolean(stockItem),
        minStock: stockItem?.minStock ?? product.defaultMinStock,
        location: stockItem?.location ?? null,
      });
    }).length,
  };
}

export async function getProductMasterRows(organizationId: string, clinicId: string): Promise<ProductMasterRow[]> {
  const [products, pendingOrdersByProduct, abcRanksByProduct, recommendedMinStocksByProduct] = await Promise.all([
    prisma.product.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        primarySupplier: {
          select: {
            id: true,
            name: true,
          },
        },
        stockItems: {
          where: {
            clinicId,
            isUsed: true,
          },
          select: {
            id: true,
            quantity: true,
            inUseQuantity: true,
            discardedQuantity: true,
            minStock: true,
            location: true,
          },
        },
        barcodes: {
          select: {
            id: true,
            barcode: true,
            barcodeType: true,
            unitLabel: true,
            isPrimary: true,
          },
          orderBy: [
            {
              isPrimary: "desc",
            },
            {
              barcode: "asc",
            },
          ],
        },
      },
      orderBy: [
        {
          category: "asc",
        },
        {
          name: "asc",
        },
        {
          id: "asc",
        },
      ],
    }),
    getPendingOrdersByProduct(organizationId, clinicId),
    getProductAbcRanks(organizationId, clinicId),
    getRecommendedMinStocks(organizationId, clinicId),
  ]);

  return products.map((product) =>
    toProductMasterRow(product, {
      pendingOrdersByProduct,
      abcRanksByProduct,
      recommendedMinStocksByProduct,
    }),
  );
}

export async function getProductMasterPage(
  organizationId: string,
  clinicId: string,
  params: ProductMasterPageParams = {},
): Promise<ProductMasterPageResult> {
  const { page, pageSize } = normalizeProductMasterPageInput(params.page, params.pageSize);

  if (params.setup === "1") {
    const rows = (await getProductMasterRows(organizationId, clinicId)).filter((row) =>
      productMatchesCurrentMasterFilters(row, params),
    );
    const total = rows.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    return {
      rows: getProductMasterPageSlice(rows, page, pageSize),
      total,
      page,
      pageSize,
      pageCount,
    };
  }

  const query = params.q?.trim();
  const where = {
    organizationId,
    isActive: true,
    ...(params.category ? { category: params.category } : {}),
    ...(params.source === "purchase-history" ? { importSource: productImportSources.purchaseHistory } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { nameKana: { contains: query, mode: "insensitive" as const } },
            { productCode: { contains: query, mode: "insensitive" as const } },
            { janCode: { contains: query, mode: "insensitive" as const } },
            { internalCode: { contains: query, mode: "insensitive" as const } },
            { category: { contains: query, mode: "insensitive" as const } },
            { manufacturer: { contains: query, mode: "insensitive" as const } },
            { specification: { contains: query, mode: "insensitive" as const } },
            { orderUnit: { contains: query, mode: "insensitive" as const } },
            { supplierProductCode: { contains: query, mode: "insensitive" as const } },
            { notes: { contains: query, mode: "insensitive" as const } },
            {
              primarySupplier: {
                is: {
                  name: { contains: query, mode: "insensitive" as const },
                },
              },
            },
            {
              barcodes: {
                some: {
                  barcode: { contains: query, mode: "insensitive" as const },
                },
              },
            },
          ],
        }
      : {}),
  };
  const orderBy = [
    {
      category: "asc" as const,
    },
    {
      name: "asc" as const,
    },
    {
      id: "asc" as const,
    },
  ];
  const [total, products] = await Promise.all([
    prisma.product.count({
      where,
    }),
    prisma.product.findMany({
      where,
      include: {
        primarySupplier: {
          select: {
            id: true,
            name: true,
          },
        },
        stockItems: {
          where: {
            clinicId,
            isUsed: true,
          },
          select: {
            id: true,
            quantity: true,
            inUseQuantity: true,
            discardedQuantity: true,
            minStock: true,
            location: true,
          },
        },
        barcodes: {
          select: {
            id: true,
            barcode: true,
            barcodeType: true,
            unitLabel: true,
            isPrimary: true,
          },
          orderBy: [
            {
              isPrimary: "desc",
            },
            {
              barcode: "asc",
            },
          ],
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const productIds = products.map((product) => product.id);
  const [pendingOrdersByProduct, abcRanksByProduct, recommendedMinStocksByProduct] = await Promise.all([
    getPendingOrdersByProduct(organizationId, clinicId, { productIds }),
    getProductAbcRanks(organizationId, clinicId, { productIds }),
    getRecommendedMinStocks(organizationId, clinicId, { productIds }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return {
    rows: products.map((product) =>
      toProductMasterRow(product, {
        pendingOrdersByProduct,
        abcRanksByProduct,
        recommendedMinStocksByProduct,
      }),
    ),
    total,
    page,
    pageSize,
    pageCount,
  };
}

export async function getProductDetail(
  productId: string,
  organizationId: string,
  clinicId: string,
): Promise<ProductDetail | null> {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      organizationId,
      isActive: true,
    },
    include: {
      primarySupplier: {
        select: {
          id: true,
          name: true,
        },
      },
      stockItems: {
        where: {
          clinicId,
          isUsed: true,
        },
          select: {
            id: true,
            quantity: true,
            inUseQuantity: true,
            discardedQuantity: true,
            minStock: true,
            location: true,
          },
      },
      barcodes: {
        select: {
          id: true,
          barcode: true,
          barcodeType: true,
          unitLabel: true,
          isPrimary: true,
        },
        orderBy: [
          {
            isPrimary: "desc",
          },
          {
            barcode: "asc",
          },
        ],
      },
      productSuppliers: {
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          {
            isPrimary: "desc",
          },
          {
            supplier: {
              name: "asc",
            },
          },
        ],
      },
      stockMovements: {
        where: {
          clinicId,
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
      },
      stockLots: {
        where: {
          clinicId,
          quantity: {
            gt: 0,
          },
        },
        orderBy: [
          {
            expiryDate: "asc",
          },
          {
            lotNumber: "asc",
          },
        ],
      },
      orderRequests: {
        where: {
          clinicId,
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      },
    },
  });

  if (!product) {
    return null;
  }

  const [pendingOrdersByProduct, supplierLeadTimes, abcRanksByProduct, recommendedMinStocksByProduct] = await Promise.all([
    getPendingOrderDetailsByProduct(organizationId, clinicId),
    getSupplierLeadTimes(organizationId),
    getProductAbcRanks(organizationId, clinicId),
    getRecommendedMinStocks(organizationId, clinicId),
  ]);
  const pendingOrderDetails = pendingOrdersByProduct[product.id] ?? {
    count: 0,
    totalQuantity: 0,
    latestOrderedAt: null,
    suppliers: [],
  };

  const stockItem = product.stockItems[0];
  const currentQuantity = stockItem?.quantity ?? 0;
  const inUseQuantity = stockItem?.inUseQuantity ?? 0;
  const discardedQuantity = stockItem?.discardedQuantity ?? 0;
  const minStock = stockItem?.minStock ?? product.defaultMinStock;
  const barcodes =
    product.barcodes.length > 0
      ? product.barcodes
      : product.janCode
        ? [
            {
              id: null,
              barcode: product.janCode,
              barcodeType: "JAN",
              unitLabel: product.orderUnit,
              isPrimary: true,
            },
          ]
        : [];
  const productSuppliers: ProductSupplierSummary[] = product.productSuppliers.map((productSupplier) => ({
    id: productSupplier.id,
    supplierId: productSupplier.supplier.id,
    supplierName: productSupplier.supplier.name,
    supplierProductCode: productSupplier.supplierProductCode,
    orderUnit: productSupplier.orderUnit,
    standardPrice: productSupplier.standardPrice,
    isPrimary: productSupplier.isPrimary,
    isActive: productSupplier.isActive,
    notes: productSupplier.notes,
    leadTime: supplierLeadTimes[productSupplier.supplier.id] ?? null,
  }));

  if (product.primarySupplier && !productSuppliers.some((productSupplier) => productSupplier.supplierId === product.primarySupplier?.id)) {
    productSuppliers.unshift({
      id: null,
      supplierId: product.primarySupplier.id,
      supplierName: product.primarySupplier.name,
      supplierProductCode: product.supplierProductCode,
      orderUnit: product.orderUnit,
      standardPrice: product.standardPrice,
      isPrimary: true,
      isActive: true,
      notes: null,
      leadTime: supplierLeadTimes[product.primarySupplier.id] ?? null,
    });
  }

  return {
    id: product.id,
    productCode: product.productCode,
    janCode: product.janCode,
    internalCode: product.internalCode,
    name: product.name,
    nameKana: product.nameKana,
    category: product.category,
    manufacturer: product.manufacturer,
    specification: normalizeDemoSpecification(product.specification, product.name, product.orderUnit),
    orderUnit: product.orderUnit,
    supplierId: product.primarySupplier?.id ?? null,
    supplierName: product.primarySupplier?.name ?? null,
    supplierProductCode: product.supplierProductCode,
    standardPrice: product.standardPrice,
    defaultMinStock: product.defaultMinStock,
    stockUsageMode: product.stockUsageMode,
    currentQuantity,
    inUseQuantity,
    discardedQuantity,
    totalQuantity: currentQuantity + inUseQuantity,
    minStock,
    hasStockItem: Boolean(stockItem),
    stockItemId: stockItem?.id ?? null,
    location: stockItem?.location ?? null,
    photoFileName: product.photoFileName,
    photoMimeType: product.photoMimeType,
    photoUpdatedAt: product.photoUpdatedAt,
    importSource: product.importSource,
    barcodes,
    notes: product.notes,
    pendingOrders: {
      count: pendingOrderDetails.count,
      totalQuantity: pendingOrderDetails.totalQuantity,
      latestOrderedAt: pendingOrderDetails.latestOrderedAt,
    },
    abcRank: abcRanksByProduct[product.id] ?? {
      rank: "UNUSED",
      totalQuantity: 0,
      share: 0,
    },
    recommendedMinStock: recommendedMinStocksByProduct[product.id] ?? {
      recommended: null,
      totalOut90d: 0,
      monthlyUsage: 0,
      leadDays: 7,
      safetyFactor: 1.5,
      sampleSufficient: false,
      usesFallbackLeadTime: true,
      leadTimeSampleCount: null,
    },
    primarySupplierId: product.primarySupplier?.id ?? null,
    productSuppliers,
    pendingOrderSuppliers: pendingOrderDetails.suppliers,
    stockLots: product.stockLots.map((lot) => ({
      id: lot.id,
      lotNumber: lot.lotNumber,
      expiryDateText: lot.expiryDateText,
      expiryDate: lot.expiryDate,
      quantity: lot.quantity,
      updatedAt: lot.updatedAt,
    })),
    recentMovements: product.stockMovements.map((movement) => ({
      id: movement.id,
      movementType: movement.movementType,
      quantity: movement.quantity,
      beforeQuantity: movement.beforeQuantity,
      afterQuantity: movement.afterQuantity,
      reason: movement.reason,
      memo: movement.memo,
      sourceType: movement.sourceType,
      lotNumber: movement.lotNumber,
      expiryDateText: movement.expiryDateText,
      expiryDate: movement.expiryDate,
      userName: movement.user.name,
      createdAt: movement.createdAt,
    })),
    orderRequests: product.orderRequests.map((request) => ({
      id: request.id,
      status: request.status,
      requestedQuantity: request.requestedQuantity,
      memo: request.memo,
      supplierId: request.supplier?.id ?? product.primarySupplier?.id ?? null,
      orderRecordId: request.orderRecordId,
      supplierName: request.supplier?.name ?? null,
      orderedAt: request.orderedAt,
      orderedMethod: request.orderedMethod,
      orderedMemo: request.orderedMemo,
      supplierResponseMemo: request.supplierResponseMemo,
      receivedQuantity: request.receivedQuantity,
      receivedAt: request.receivedAt,
      receivedMemo: request.receivedMemo,
      receivedLotNumber: request.receivedLotNumber,
      receivedExpiryDateText: request.receivedExpiryDateText,
      receivedExpiryDate: request.receivedExpiryDate,
      updatedAt: request.updatedAt,
    })),
  };
}
