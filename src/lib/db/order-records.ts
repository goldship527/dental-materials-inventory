import { prisma } from "@/lib/db/prisma";
import type { OrderSendMethodValue } from "@/lib/orders/send-method";

export type OrderRecordListRequest = {
  id: string;
  productId: string;
  productName: string;
  productCode: string | null;
  requestedQuantity: number;
  receivedQuantity: number | null;
  receivedAt: Date | null;
};

export type OrderRecordListRow = {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  orderedAt: Date;
  orderedMethod: OrderSendMethodValue;
  orderedMemo: string | null;
  supplierResponseMemo: string | null;
  createdByUserName: string;
  requestCount: number;
  totalRequestedQuantity: number;
  receivedRequestCount: number;
  totalReceivedQuantity: number;
  requests: OrderRecordListRequest[];
  createdAt: Date;
  updatedAt: Date;
};

export async function getOrderRecordListRows(clinicId: string): Promise<OrderRecordListRow[]> {
  const records = await prisma.orderRecord.findMany({
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
      createdByUser: {
        select: {
          name: true,
        },
      },
      orderRequests: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              productCode: true,
            },
          },
        },
        orderBy: [
          {
            createdAt: "asc",
          },
          {
            id: "asc",
          },
        ],
      },
    },
    orderBy: [
      {
        orderedAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });

  return records.map((record) => {
    const requests = record.orderRequests.map((request) => ({
      id: request.id,
      productId: request.product.id,
      productName: request.product.name,
      productCode: request.product.productCode,
      requestedQuantity: request.requestedQuantity,
      receivedQuantity: request.receivedQuantity,
      receivedAt: request.receivedAt,
    }));
    const receivedRequests = requests.filter((request) => request.receivedAt);

    return {
      id: record.id,
      supplierId: record.supplier?.id ?? null,
      supplierName: record.supplier?.name ?? null,
      orderedAt: record.orderedAt,
      orderedMethod: record.orderedMethod,
      orderedMemo: record.orderedMemo,
      supplierResponseMemo: record.supplierResponseMemo,
      createdByUserName: record.createdByUser.name,
      requestCount: requests.length,
      totalRequestedQuantity: requests.reduce((sum, request) => sum + request.requestedQuantity, 0),
      receivedRequestCount: receivedRequests.length,
      totalReceivedQuantity: receivedRequests.reduce((sum, request) => sum + (request.receivedQuantity ?? 0), 0),
      requests,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  });
}
