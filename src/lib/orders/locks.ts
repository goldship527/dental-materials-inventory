import type { Prisma } from "@prisma/client";

async function lockTransactionKey(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

export async function lockOrderRequestProduct(
  tx: Prisma.TransactionClient,
  clinicId: string,
  productId: string,
) {
  await lockTransactionKey(tx, `order-request:${clinicId}:${productId}`);
}

export async function lockOrderRequestProducts(
  tx: Prisma.TransactionClient,
  clinicId: string,
  productIds: Iterable<string>,
) {
  for (const productId of [...new Set(productIds)].sort()) {
    await lockOrderRequestProduct(tx, clinicId, productId);
  }
}

export async function lockOrderRequestScopes(
  tx: Prisma.TransactionClient,
  scopes: Iterable<{ clinicId: string; productId: string }>,
) {
  const keys = new Map<string, { clinicId: string; productId: string }>();
  for (const scope of scopes) keys.set(`${scope.clinicId}\u0000${scope.productId}`, scope);
  for (const key of [...keys.keys()].sort()) {
    const scope = keys.get(key)!;
    await lockOrderRequestProduct(tx, scope.clinicId, scope.productId);
  }
}

export async function lockOrderReceipt(tx: Prisma.TransactionClient, orderRequestId: string) {
  await lockTransactionKey(tx, `order-receipt:${orderRequestId}`);
}

export async function lockStockItem(tx: Prisma.TransactionClient, clinicId: string, productId: string) {
  await lockTransactionKey(tx, `stock-item:${clinicId}:${productId}`);
}

export async function lockNamedTransactionResource(tx: Prisma.TransactionClient, key: string) {
  await lockTransactionKey(tx, key);
}
