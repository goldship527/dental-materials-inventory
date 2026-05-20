import { prisma } from "@/lib/db/prisma";
import { analyzeBarcodeInput } from "@/lib/barcode/gs1";

export type BarcodeSearchResult = {
  productId: string;
  productName: string;
  productCode: string | null;
  janCode: string | null;
  category: string | null;
  manufacturer: string | null;
  specification: string | null;
  orderUnit: string | null;
  supplierId: string | null;
  supplierName: string | null;
  quantity: number;
  minStock: number;
  location: string | null;
  matchedBarcodes: BarcodeMatch[];
};

export type BarcodeMatch = {
  barcode: string;
  barcodeType: string;
  unitLabel: string | null;
  isPrimary: boolean;
  source: "product_barcodes" | "products.janCode";
};

export async function searchProductsByBarcode(clinicId: string, barcode: string): Promise<BarcodeSearchResult[]> {
  if (barcode.length > 300) {
    return [];
  }

  const analysis = analyzeBarcodeInput(barcode);
  const searchValues = analysis.searchValues;

  if (searchValues.length === 0) {
    return [];
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      stockItems: {
        some: {
          clinicId,
          isUsed: true,
        },
      },
      OR: [
        {
          janCode: {
            in: searchValues,
          },
        },
        {
          barcodes: {
            some: {
              barcode: {
                in: searchValues,
              },
            },
          },
        },
      ],
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
        where: {
          barcode: {
            in: searchValues,
          },
        },
        select: {
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
    const quantity = stockItem?.quantity ?? 0;
    const minStock = stockItem?.minStock ?? product.defaultMinStock;
    const barcodeMatches: BarcodeMatch[] = product.barcodes.map((barcodeItem) => ({
      barcode: barcodeItem.barcode,
      barcodeType: barcodeItem.barcodeType,
      unitLabel: barcodeItem.unitLabel,
      isPrimary: barcodeItem.isPrimary,
      source: "product_barcodes",
    }));
    const hasJanMatch = product.janCode ? searchValues.includes(product.janCode) : false;

    if (hasJanMatch && product.janCode && !barcodeMatches.some((barcodeItem) => barcodeItem.barcode === product.janCode)) {
      barcodeMatches.unshift({
        barcode: product.janCode,
        barcodeType: "JAN",
        unitLabel: product.orderUnit,
        isPrimary: true,
        source: "products.janCode",
      });
    }

    return {
      productId: product.id,
      productName: product.name,
      productCode: product.productCode,
      janCode: product.janCode,
      category: product.category,
      manufacturer: product.manufacturer,
      specification: product.specification,
      orderUnit: product.orderUnit,
      supplierId: product.primarySupplier?.id ?? null,
      supplierName: product.primarySupplier?.name ?? null,
      quantity,
      minStock,
      location: stockItem?.location ?? null,
      matchedBarcodes: barcodeMatches,
    };
  });
}
