import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

// 目的:
//   docs/codex-handoff-list-performance-fixes.md 修正2（安定タイブレーカ）の回帰テスト。
//   同名・同カテゴリの行が複数あっても、ページングが「全行を重複なく欠落なく」分割することを検証する。
//   pageSize=1 で全ページを連結し、getStockRows / getProductMasterRows の全件と集合一致すること、
//   かつ各行がちょうど1回だけ現れることを確認する。
//   タイブレーカ未追加だと（Postgres のタイ順序が不定なため）この分割性が壊れ得る。

type StockPageResult = {
  rows: { stockItemId: string }[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type ProductPageResult = {
  rows: { id: string }[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function assertExactlyOnce(ids: string[], expected: string[], label: string) {
  const counts = new Map<string, number>();
  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  // 重複なし
  for (const [id, count] of counts) {
    assert.equal(count, 1, `${label}: ${id} が ${count} 回出現（重複/欠落の疑い）`);
  }
  // 欠落なし（集合一致）
  assert.equal(counts.size, expected.length, `${label}: ユニーク件数が全件数と一致`);
  for (const id of expected) {
    assert.equal(counts.get(id), 1, `${label}: ${id} がページ連結に含まれる`);
  }
}

async function collectAllPagesStock(
  getStockPage: (clinicId: string, params: Record<string, unknown>) => Promise<StockPageResult>,
  clinicId: string,
  pageSize: number,
) {
  const first = await getStockPage(clinicId, { page: 1, pageSize });
  const ids: string[] = first.rows.map((row) => row.stockItemId);

  for (let page = 2; page <= first.pageCount; page += 1) {
    const result = await getStockPage(clinicId, { page, pageSize });
    ids.push(...result.rows.map((row) => row.stockItemId));
  }

  return { ids, total: first.total, pageCount: first.pageCount };
}

async function collectAllPagesProduct(
  getProductMasterPage: (
    organizationId: string,
    clinicId: string,
    params: Record<string, unknown>,
  ) => Promise<ProductPageResult>,
  organizationId: string,
  clinicId: string,
  pageSize: number,
) {
  const first = await getProductMasterPage(organizationId, clinicId, { page: 1, pageSize });
  const ids: string[] = first.rows.map((row) => row.id);

  for (let page = 2; page <= first.pageCount; page += 1) {
    const result = await getProductMasterPage(organizationId, clinicId, { page, pageSize });
    ids.push(...result.rows.map((row) => row.id));
  }

  return { ids, total: first.total, pageCount: first.pageCount };
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const stockModule = await import("../src/lib/db/stock");
  const productsModule = await import("../src/lib/db/products");

  const getStockRows = stockModule.getStockRows;
  const getStockPage = (stockModule as Record<string, unknown>).getStockPage as
    | ((clinicId: string, params: Record<string, unknown>) => Promise<StockPageResult>)
    | undefined;
  const getProductMasterRows = productsModule.getProductMasterRows;
  const getProductMasterPage = (productsModule as Record<string, unknown>).getProductMasterPage as
    | ((organizationId: string, clinicId: string, params: Record<string, unknown>) => Promise<ProductPageResult>)
    | undefined;

  if (typeof getStockPage !== "function" || typeof getProductMasterPage !== "function") {
    throw new Error("getStockPage / getProductMasterPage が見つかりません。フェーズ1の実装を確認してください。");
  }

  try {
    const organization = await prisma.organization.create({
      data: { name: "Pagination Stability Test Organization" },
    });
    const clinic = await prisma.clinic.create({
      data: { organizationId: organization.id, name: "Pagination Stability Test Clinic" },
    });

    // 同一カテゴリ・同一商品名を意図的に複数作る（タイブレーカが無いと順序が不定になる）
    const DUPLICATE_NAME = "重複サンプル材";
    const DUPLICATE_CATEGORY = "重複カテゴリ";
    const productCount = 12;

    for (let index = 0; index < productCount; index += 1) {
      const product = await prisma.product.create({
        data: {
          organizationId: organization.id,
          name: DUPLICATE_NAME, // すべて同名
          productCode: `DUP-${String(index).padStart(3, "0")}`,
          category: DUPLICATE_CATEGORY, // すべて同カテゴリ
          defaultMinStock: 1,
        },
      });

      await prisma.stockItem.create({
        data: {
          clinicId: clinic.id,
          productId: product.id,
          quantity: index, // 0..11
          minStock: 1,
          isUsed: true,
        },
      });
    }

    // ---- 在庫: 全件 ----
    const allStockRows = (await getStockRows(clinic.id)) as unknown as { stockItemId: string }[];
    assert.equal(allStockRows.length, productCount, "getStockRows の件数");
    const expectedStockIds = allStockRows.map((row) => row.stockItemId);

    // pageSize=1 で全ページ連結 → 重複なし・欠落なし
    const stockCollected = await collectAllPagesStock(getStockPage, clinic.id, 1);
    assert.equal(stockCollected.total, productCount, "在庫 total が全件");
    assert.equal(stockCollected.pageCount, productCount, "在庫 pageCount が全件（pageSize=1）");
    assertExactlyOnce(stockCollected.ids, expectedStockIds, "在庫ページング分割");

    // pageSize=5 でも分割が完全であること（端数ページ含む）
    const stockCollected5 = await collectAllPagesStock(getStockPage, clinic.id, 5);
    assertExactlyOnce(stockCollected5.ids, expectedStockIds, "在庫ページング分割(pageSize=5)");

    // ---- 商品マスタ: 全件 ----
    const allProductRows = (await getProductMasterRows(organization.id, clinic.id)) as unknown as { id: string }[];
    assert.equal(allProductRows.length, productCount, "getProductMasterRows の件数");
    const expectedProductIds = allProductRows.map((row) => row.id);

    const productCollected = await collectAllPagesProduct(getProductMasterPage, organization.id, clinic.id, 1);
    assert.equal(productCollected.total, productCount, "商品 total が全件");
    assert.equal(productCollected.pageCount, productCount, "商品 pageCount が全件（pageSize=1）");
    assertExactlyOnce(productCollected.ids, expectedProductIds, "商品ページング分割");

    const productCollected5 = await collectAllPagesProduct(getProductMasterPage, organization.id, clinic.id, 5);
    assertExactlyOnce(productCollected5.ids, expectedProductIds, "商品ページング分割(pageSize=5)");

    console.log("list-pagination-stability.test.ts: OK");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
