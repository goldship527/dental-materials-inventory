import { prisma } from "@/lib/db/prisma";
import {
  createEmptyOrderRequestStatusCounts,
  printableOrderRequestStatuses,
  type OrderRequestStatusValue,
} from "@/lib/orders/status";

export type OrderRequestRow = {
  id: string;
  productId: string;
  productCode: string | null;
  name: string;
  category: string | null;
  supplierId: string | null;
  supplierName: string | null;
  supplierAddress: string | null;
  supplierPhone: string | null;
  supplierFax: string | null;
  supplierEmail: string | null;
  supplierContactPersonName: string | null;
  supplierContactPersonEmail: string | null;
  quantity: number;
  minStock: number;
  shortageCount: number;
  requestedQuantity: number;
  status: OrderRequestStatusValue;
  memo: string | null;
  orderedAt: Date | null;
  updatedAt: Date;
};

export type OrderRequestStatusCounts = Record<OrderRequestStatusValue, number>;

export async function getOrderRequestRows(clinicId: string): Promise<OrderRequestRow[]> {
  const requests = await prisma.orderRequest.findMany({
    where: {
      clinicId,
    },
    include: {
      product: {
        include: {
          stockItems: {
            where: {
              clinicId,
              isUsed: true,
            },
          },
          primarySupplier: true,
        },
      },
      supplier: true,
    },
    orderBy: [
      {
        status: "asc",
      },
      {
        updatedAt: "desc",
      },
    ],
  });

  return requests.map((request) => {
    const stockItem = request.product.stockItems[0];
    const quantity = stockItem?.quantity ?? 0;
    const minStock = stockItem?.minStock ?? request.product.defaultMinStock;

    return {
      id: request.id,
      productId: request.productId,
      productCode: request.product.productCode,
      name: request.product.name,
      category: request.product.category,
      supplierId: request.supplier?.id ?? request.product.primarySupplier?.id ?? null,
      supplierName: request.supplier?.name ?? request.product.primarySupplier?.name ?? null,
      supplierAddress: request.supplier?.address ?? request.product.primarySupplier?.address ?? null,
      supplierPhone: request.supplier?.phone ?? request.product.primarySupplier?.phone ?? null,
      supplierFax: request.supplier?.fax ?? request.product.primarySupplier?.fax ?? null,
      supplierEmail: request.supplier?.email ?? request.product.primarySupplier?.email ?? null,
      supplierContactPersonName:
        request.supplier?.contactPersonName ?? request.product.primarySupplier?.contactPersonName ?? null,
      supplierContactPersonEmail:
        request.supplier?.contactPersonEmail ?? request.product.primarySupplier?.contactPersonEmail ?? null,
      quantity,
      minStock,
      shortageCount: Math.max(0, minStock - quantity),
      requestedQuantity: request.requestedQuantity,
      status: request.status,
      memo: request.memo,
      orderedAt: request.orderedAt,
      updatedAt: request.updatedAt,
    };
  });
}

export async function getActiveOrderRequestProductIds(clinicId: string) {
  const requests = await prisma.orderRequest.findMany({
    where: {
      clinicId,
      status: {
        in: printableOrderRequestStatuses,
      },
    },
    select: {
      productId: true,
    },
  });

  return new Set(requests.map((request) => request.productId));
}

export async function countDraftOrderRequests(clinicId: string) {
  return prisma.orderRequest.count({
    where: {
      clinicId,
      status: "DRAFT",
    },
  });
}

export async function getOrderRequestStatusCounts(clinicId: string): Promise<OrderRequestStatusCounts> {
  const rows = await prisma.orderRequest.groupBy({
    by: ["status"],
    where: {
      clinicId,
    },
    _count: {
      _all: true,
    },
  });
  const counts: OrderRequestStatusCounts = createEmptyOrderRequestStatusCounts();

  for (const row of rows) {
    counts[row.status] = row._count._all;
  }

  return counts;
}
