import type {
  PurchaseHistoryExistingProduct,
  PurchaseHistoryImportPreview,
} from "@/lib/imports/purchase-history-import";

function collectPreviewProductIds(preview: PurchaseHistoryImportPreview) {
  const productIds = new Set<string>();

  for (const row of preview.rows) {
    if (row.matchedProductId) {
      productIds.add(row.matchedProductId);
    }

    for (const candidateProductId of row.candidateProductIds) {
      productIds.add(candidateProductId);
    }
  }

  return productIds;
}

export function buildProductNamesByIdForPreview(
  existingProducts: PurchaseHistoryExistingProduct[],
  preview: PurchaseHistoryImportPreview,
) {
  const previewProductIds = collectPreviewProductIds(preview);

  return Object.fromEntries(
    existingProducts
      .filter((product) => previewProductIds.has(product.id))
      .map((product) => [product.id, product.name]),
  );
}
