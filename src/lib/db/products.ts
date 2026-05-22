import { prisma } from "@/lib/db/prisma";
import type { OrderRequestStatusValue } from "@/lib/orders/status";

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
  currentQuantity: number;
  minStock: number;
  hasStockItem: boolean;
  location: string | null;
  photoFileName: string | null;
  photoMimeType: string | null;
  photoUpdatedAt: Date | null;
  barcodes: ProductBarcodeSummary[];
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

export type ProductDetail = ProductMasterRow & {
  notes: string | null;
  primarySupplierId: string | null;
  productSuppliers: ProductSupplierSummary[];
  recentMovements: ProductDetailMovement[];
  orderRequests: ProductDetailOrderRequest[];
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
};

export type ProductDetailMovement = {
  id: string;
  movementType: string;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  reason: string | null;
  sourceType: string | null;
  userName: string;
  createdAt: Date;
};

export type ProductDetailOrderRequest = {
  id: string;
  status: OrderRequestStatusValue;
  requestedQuantity: number;
  memo: string | null;
  supplierId: string | null;
  supplierName: string | null;
  orderedAt: Date | null;
  updatedAt: Date;
};

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

export async function getProductMasterRows(organizationId: string, clinicId: string): Promise<ProductMasterRow[]> {
  const products = await prisma.product.findMany({
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
          quantity: true,
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
    ],
  });

  return products.map((product) => {
    const stockItem = product.stockItems[0];
    const currentQuantity = stockItem?.quantity ?? 0;
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
      specification: product.specification,
      orderUnit: product.orderUnit,
      supplierId: product.primarySupplier?.id ?? null,
      supplierName: product.primarySupplier?.name ?? null,
      supplierProductCode: product.supplierProductCode,
      standardPrice: product.standardPrice,
      defaultMinStock: product.defaultMinStock,
      currentQuantity,
      minStock,
      hasStockItem: Boolean(stockItem),
      location: stockItem?.location ?? null,
      photoFileName: product.photoFileName,
      photoMimeType: product.photoMimeType,
      photoUpdatedAt: product.photoUpdatedAt,
      barcodes,
    };
  });
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
          quantity: true,
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

  const stockItem = product.stockItems[0];
  const currentQuantity = stockItem?.quantity ?? 0;
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
    specification: product.specification,
    orderUnit: product.orderUnit,
    supplierId: product.primarySupplier?.id ?? null,
    supplierName: product.primarySupplier?.name ?? null,
    supplierProductCode: product.supplierProductCode,
    standardPrice: product.standardPrice,
    defaultMinStock: product.defaultMinStock,
    currentQuantity,
    minStock,
    hasStockItem: Boolean(stockItem),
    location: stockItem?.location ?? null,
    photoFileName: product.photoFileName,
    photoMimeType: product.photoMimeType,
    photoUpdatedAt: product.photoUpdatedAt,
    barcodes,
    notes: product.notes,
    primarySupplierId: product.primarySupplier?.id ?? null,
    productSuppliers,
    recentMovements: product.stockMovements.map((movement) => ({
      id: movement.id,
      movementType: movement.movementType,
      quantity: movement.quantity,
      beforeQuantity: movement.beforeQuantity,
      afterQuantity: movement.afterQuantity,
      reason: movement.reason,
      sourceType: movement.sourceType,
      userName: movement.user.name,
      createdAt: movement.createdAt,
    })),
    orderRequests: product.orderRequests.map((request) => ({
      id: request.id,
      status: request.status,
      requestedQuantity: request.requestedQuantity,
      memo: request.memo,
      supplierId: request.supplier?.id ?? product.primarySupplier?.id ?? null,
      supplierName: request.supplier?.name ?? null,
      orderedAt: request.orderedAt,
      updatedAt: request.updatedAt,
    })),
  };
}
