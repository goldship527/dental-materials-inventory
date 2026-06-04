export type MovementQuantityByProductInput = {
  productId: string;
  quantity: number | null;
};

export function normalizeOutQuantity(quantity: number | null | undefined) {
  return Math.abs(quantity ?? 0);
}

export function sumOutQuantitiesByProduct(movements: MovementQuantityByProductInput[]) {
  const quantityByProduct = new Map<string, number>();

  for (const movement of movements) {
    quantityByProduct.set(
      movement.productId,
      (quantityByProduct.get(movement.productId) ?? 0) + normalizeOutQuantity(movement.quantity),
    );
  }

  return quantityByProduct;
}
