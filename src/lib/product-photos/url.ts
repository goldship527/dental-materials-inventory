export type ProductPhotoUrlSource = {
  id: string;
  photoUpdatedAt: Date | number | null;
};

export function buildProductPhotoUrl(product: ProductPhotoUrlSource) {
  if (product.photoUpdatedAt === null) {
    return null;
  }

  const version = product.photoUpdatedAt instanceof Date ? product.photoUpdatedAt.getTime() : product.photoUpdatedAt;

  return `/api/product-photos/${product.id}?v=${version}`;
}
