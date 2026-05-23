import { prisma } from "@/lib/db/prisma";
import type { OrderSendMethodValue } from "@/lib/orders/send-method";
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
  orderRecordId: string | null;
  supplierName: string | null;
  supplierAddress: string | null;
  supplierPhone: string | null;
  supplierFax: string | null;
  supplierEmail: string | null;
  supplierContactPersonName: string | null;
  supplierContactPersonEmail: string | null;
  supplierProductCode: string | null;
  orderUnit: string | null;
  standardPrice: number | null;
  supplierOptions: OrderRequestSupplierOption[];
  quantity: number;
  minStock: number;
  shortageCount: number;
  requestedQuantity: number;
  status: OrderRequestStatusValue;
  memo: string | null;
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

export type OrderRequestSupplierOption = {
  supplierId: string;
  supplierName: string;
  supplierProductCode: string | null;
  orderUnit: string | null;
  standardPrice: number | null;
  isPrimary: boolean;
  isActive: boolean;
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
    const supplierOptions: OrderRequestSupplierOption[] = request.product.productSuppliers.map((productSupplier) => ({
      supplierId: productSupplier.supplier.id,
      supplierName: productSupplier.supplier.name,
      supplierProductCode: productSupplier.supplierProductCode,
      orderUnit: productSupplier.orderUnit,
      standardPrice: productSupplier.standardPrice,
      isPrimary: productSupplier.isPrimary,
      isActive: productSupplier.isActive,
    }));
    const hasPrimarySupplierOption =
      request.product.primarySupplier &&
      supplierOptions.some((supplierOption) => supplierOption.supplierId === request.product.primarySupplier?.id);

    if (request.product.primarySupplier && !hasPrimarySupplierOption) {
      supplierOptions.unshift({
        supplierId: request.product.primarySupplier.id,
        supplierName: request.product.primarySupplier.name,
        supplierProductCode: request.product.supplierProductCode,
        orderUnit: request.product.orderUnit,
        standardPrice: request.product.standardPrice,
        isPrimary: true,
        isActive: true,
      });
    }

    const selectedSupplierId = request.supplier?.id ?? request.product.primarySupplier?.id ?? null;
    const selectedSupplierOption = supplierOptions.find(
      (supplierOption) => supplierOption.supplierId === selectedSupplierId,
    );

    return {
      id: request.id,
      productId: request.productId,
      productCode: request.product.productCode,
      name: request.product.name,
      category: request.product.category,
      supplierId: request.supplier?.id ?? request.product.primarySupplier?.id ?? null,
      orderRecordId: request.orderRecordId,
      supplierName: request.supplier?.name ?? request.product.primarySupplier?.name ?? null,
      supplierAddress: request.supplier?.address ?? request.product.primarySupplier?.address ?? null,
      supplierPhone: request.supplier?.phone ?? request.product.primarySupplier?.phone ?? null,
      supplierFax: request.supplier?.fax ?? request.product.primarySupplier?.fax ?? null,
      supplierEmail: request.supplier?.email ?? request.product.primarySupplier?.email ?? null,
      supplierContactPersonName:
        request.supplier?.contactPersonName ?? request.product.primarySupplier?.contactPersonName ?? null,
      supplierContactPersonEmail:
        request.supplier?.contactPersonEmail ?? request.product.primarySupplier?.contactPersonEmail ?? null,
      supplierProductCode: selectedSupplierOption?.supplierProductCode ?? null,
      orderUnit: selectedSupplierOption?.orderUnit ?? request.product.orderUnit,
      standardPrice: selectedSupplierOption?.standardPrice ?? null,
      supplierOptions,
      quantity,
      minStock,
      shortageCount: Math.max(0, minStock - quantity),
      requestedQuantity: request.requestedQuantity,
      status: request.status,
      memo: request.memo,
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
