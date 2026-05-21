import { prisma } from "@/lib/db/prisma";

export type OnboardingSummary = {
  productCount: number;
  supplierCount: number;
  productsWithSupplierCount: number;
  productsWithBarcodeCount: number;
  productsWithStockItemCount: number;
  productsWithMinStockCount: number;
  unresolvedBarcodeScanCount: number;
  productImportHistoryCount: number;
  missingSupplierCount: number;
  missingBarcodeCount: number;
  missingStockItemCount: number;
  missingMinStockCount: number;
  completedStepCount: number;
  totalStepCount: number;
};

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  status: "done" | "todo" | "attention";
  metric: string;
};

export function buildOnboardingSteps(summary: OnboardingSummary): OnboardingStep[] {
  return [
    {
      id: "products",
      title: "商品マスタを登録する",
      description: "日常的に管理する材料・消耗品を商品として登録します。",
      href: "/products/import",
      actionLabel: "一括取り込みへ",
      status: summary.productCount > 0 ? "done" : "todo",
      metric: `${summary.productCount} 件`,
    },
    {
      id: "suppliers",
      title: "発注先を確認する",
      description: "商品に紐づける発注先マスタが用意されているか確認します。",
      href: "/suppliers",
      actionLabel: "発注先を見る",
      status: summary.supplierCount > 0 ? "done" : "todo",
      metric: `${summary.supplierCount} 件`,
    },
    {
      id: "product-suppliers",
      title: "商品と発注先を紐づける",
      description: "不足時にどこへ発注するか分かるよう、主発注先を設定します。",
      href: "/products",
      actionLabel: "商品を確認",
      status: summary.productCount === 0 ? "todo" : summary.missingSupplierCount === 0 ? "done" : "attention",
      metric: `未設定 ${summary.missingSupplierCount} 件`,
    },
    {
      id: "barcodes",
      title: "バーコードを整理する",
      description: "JANコードや追加バーコードを登録し、未対応の読み取り履歴を片づけます。",
      href: summary.unresolvedBarcodeScanCount > 0 ? "/barcode/scans/unresolved" : "/barcode",
      actionLabel: summary.unresolvedBarcodeScanCount > 0 ? "未対応を整理" : "バーコード検索へ",
      status:
        summary.productCount === 0
          ? "todo"
          : summary.missingBarcodeCount === 0 && summary.unresolvedBarcodeScanCount === 0
            ? "done"
            : "attention",
      metric: `未登録 ${summary.missingBarcodeCount} 件 / 未対応 ${summary.unresolvedBarcodeScanCount} 件`,
    },
    {
      id: "stock",
      title: "在庫行と最低在庫を設定する",
      description: "現在庫、保管場所、最低在庫を確認し、不足判定に使える状態にします。",
      href: "/inventory",
      actionLabel: "在庫一覧へ",
      status:
        summary.productCount === 0
          ? "todo"
          : summary.missingStockItemCount === 0 && summary.missingMinStockCount === 0
            ? "done"
            : "attention",
      metric: `在庫未設定 ${summary.missingStockItemCount} 件 / 最低在庫未設定 ${summary.missingMinStockCount} 件`,
    },
  ];
}

export async function getOnboardingSummary(organizationId: string, clinicId: string): Promise<OnboardingSummary> {
  const [
    productCount,
    supplierCount,
    productsWithSupplierCount,
    productsWithBarcodeCount,
    productsForStockSetup,
    unresolvedBarcodeScanCount,
    productImportHistoryCount,
  ] = await Promise.all([
    prisma.product.count({
      where: {
        organizationId,
        isActive: true,
      },
    }),
    prisma.supplier.count({
      where: {
        organizationId,
      },
    }),
    prisma.product.count({
      where: {
        organizationId,
        isActive: true,
        primarySupplierId: {
          not: null,
        },
      },
    }),
    prisma.product.count({
      where: {
        organizationId,
        isActive: true,
        OR: [
          {
            janCode: {
              not: null,
            },
          },
          {
            barcodes: {
              some: {},
            },
          },
        ],
      },
    }),
    prisma.product.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: {
        defaultMinStock: true,
        stockItems: {
          where: {
            clinicId,
            isUsed: true,
          },
          select: {
            minStock: true,
          },
        },
      },
    }),
    prisma.barcodeScanLog.count({
      where: {
        clinicId,
        resolveStatus: "UNRESOLVED",
        matchType: {
          in: ["NO_MATCH", "PRODUCT_MULTI", "SAMPLE"],
        },
      },
    }),
    prisma.productImportHistory.count({
      where: {
        organizationId,
      },
    }),
  ]);
  const productsWithStockItemCount = productsForStockSetup.filter((product) => product.stockItems.length > 0).length;
  const productsWithMinStockCount = productsForStockSetup.filter((product) => {
    const stockItem = product.stockItems[0];
    const minStock = stockItem?.minStock ?? product.defaultMinStock;

    return minStock > 0;
  }).length;
  const summaryWithoutStepCount = {
    productCount,
    supplierCount,
    productsWithSupplierCount,
    productsWithBarcodeCount,
    productsWithStockItemCount,
    productsWithMinStockCount,
    unresolvedBarcodeScanCount,
    productImportHistoryCount,
    missingSupplierCount: Math.max(productCount - productsWithSupplierCount, 0),
    missingBarcodeCount: Math.max(productCount - productsWithBarcodeCount, 0),
    missingStockItemCount: Math.max(productCount - productsWithStockItemCount, 0),
    missingMinStockCount: Math.max(productCount - productsWithMinStockCount, 0),
  };
  const steps = buildOnboardingSteps({
    ...summaryWithoutStepCount,
    completedStepCount: 0,
    totalStepCount: 0,
  });

  return {
    ...summaryWithoutStepCount,
    completedStepCount: steps.filter((step) => step.status === "done").length,
    totalStepCount: steps.length,
  };
}
