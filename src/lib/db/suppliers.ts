import { prisma } from "@/lib/db/prisma";
import type { OrderRequestStatusValue } from "@/lib/orders/status";

export type SupplierMasterRow = {
  id: string;
  name: string;
  productCount: number;
  shortageProductCount: number;
  categories: string[];
  sampleProductNames: string[];
  orderRequestCounts: Record<OrderRequestStatusValue, number>;
};

export type SupplierDetail = SupplierMasterRow & {
  products: SupplierDetailProduct[];
  orderRequests: SupplierDetailOrderRequest[];
};

export type SupplierDetailProduct = {
  id: string;
  productCode: string | null;
  name: string;
  category: string | null;
  orderUnit: string | null;
  supplierProductCode: string | null;
  quantity: number;
  minStock: number;
  shortageCount: number;
  location: string | null;
};

export type SupplierDetailOrderRequest = {
  id: string;
  productId: string;
  productName: string;
  productCode: string | null;
  status: OrderRequestStatusValue;
  requestedQuantity: number;
  memo: string | null;
  updatedAt: Date;
};

export async function getSupplierMasterRows(organizationId: string, clinicId: string): Promise<SupplierMasterRow[]> {
  const suppliers = await prisma.supplier.findMany({
    where: {
      organizationId,
    },
    include: {
      products: {
        where: {
          isActive: true,
          stockItems: {
            some: {
              clinicId,
              isUsed: true,
            },
          },
        },
        include: {
          stockItems: {
            where: {
              clinicId,
              isUsed: true,
            },
            select: {
              quantity: true,
              minStock: true,
            },
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
      },
      orderRequests: {
        where: {
          clinicId,
        },
        select: {
          status: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return suppliers.map((supplier) => {
    const categories = Array.from(
      new Set(supplier.products.map((product) => product.category).filter((category): category is string => Boolean(category))),
    ).sort((a, b) => a.localeCompare(b, "ja"));
    const shortageProductCount = supplier.products.filter((product) => {
      const stockItem = product.stockItems[0];
      const quantity = stockItem?.quantity ?? 0;
      const minStock = stockItem?.minStock ?? product.defaultMinStock;

      return quantity <= minStock;
    }).length;
    const orderRequestCounts: Record<OrderRequestStatusValue, number> = {
      DRAFT: 0,
      CONFIRMED: 0,
      SKIPPED: 0,
    };

    for (const request of supplier.orderRequests) {
      orderRequestCounts[request.status] += 1;
    }

    return {
      id: supplier.id,
      name: supplier.name,
      productCount: supplier.products.length,
      shortageProductCount,
      categories,
      sampleProductNames: supplier.products.slice(0, 5).map((product) => product.name),
      orderRequestCounts,
    };
  });
}

export async function getSupplierDetail(
  supplierId: string,
  organizationId: string,
  clinicId: string,
): Promise<SupplierDetail | null> {
  const supplier = await prisma.supplier.findFirst({
    where: {
      id: supplierId,
      organizationId,
    },
    include: {
      products: {
        where: {
          isActive: true,
          stockItems: {
            some: {
              clinicId,
              isUsed: true,
            },
          },
        },
        include: {
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
        },
        orderBy: [
          {
            category: "asc",
          },
          {
            name: "asc",
          },
        ],
      },
      orderRequests: {
        where: {
          clinicId,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              productCode: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      },
    },
  });

  if (!supplier) {
    return null;
  }

  const products = supplier.products.map((product) => {
    const stockItem = product.stockItems[0];
    const quantity = stockItem?.quantity ?? 0;
    const minStock = stockItem?.minStock ?? product.defaultMinStock;

    return {
      id: product.id,
      productCode: product.productCode,
      name: product.name,
      category: product.category,
      orderUnit: product.orderUnit,
      supplierProductCode: product.supplierProductCode,
      quantity,
      minStock,
      shortageCount: Math.max(0, minStock - quantity),
      location: stockItem?.location ?? null,
    };
  });
  const categories = Array.from(
    new Set(products.map((product) => product.category).filter((category): category is string => Boolean(category))),
  ).sort((a, b) => a.localeCompare(b, "ja"));
  const orderRequestCounts: Record<OrderRequestStatusValue, number> = {
    DRAFT: 0,
    CONFIRMED: 0,
    SKIPPED: 0,
  };

  for (const request of supplier.orderRequests) {
    orderRequestCounts[request.status] += 1;
  }

  return {
    id: supplier.id,
    name: supplier.name,
    productCount: products.length,
    shortageProductCount: products.filter((product) => product.quantity <= product.minStock).length,
    categories,
    sampleProductNames: products.slice(0, 5).map((product) => product.name),
    orderRequestCounts,
    products,
    orderRequests: supplier.orderRequests.map((request) => ({
      id: request.id,
      productId: request.product.id,
      productName: request.product.name,
      productCode: request.product.productCode,
      status: request.status,
      requestedQuantity: request.requestedQuantity,
      memo: request.memo,
      updatedAt: request.updatedAt,
    })),
  };
}
