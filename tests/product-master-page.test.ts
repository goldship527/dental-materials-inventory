import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

// 目的:
//   docs/codex-handoff-list-performance.md の契約「getProductMasterPage」に対する red テスト。
//   getProductMasterPage(orgId, clinicId, params).rows が、getProductMasterRows(orgId, clinicId) +
//   現行 products/page.tsx の絞り込みを掛けてページスライスしたもの（オラクル）と「同値」であることを検証する。
//   getProductMasterPage 未実装の間は失敗（red）。実装後に green になる。
//
//   注: setup="1" の同値はこのテストでは検証しない（実装側は現行 needsInitialSetup を維持すること）。

type ProductRowLike = {
  id: string;
  name: string;
  productCode: string | null;
  janCode: string | null;
  category: string | null;
  manufacturer: string | null;
  importSource: string | null;
};

type ProductMasterPageParams = {
  q?: string;
  category?: string;
  source?: string;
  setup?: string;
  page?: number;
  pageSize?: number;
};

function idsOf(rows: ProductRowLike[]) {
  return rows.map((row) => row.id);
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const productsModule = await import("../src/lib/db/products");
  const { getProductMasterRows } = productsModule;
  const { isPurchaseHistoryImportSource } = await import("../src/lib/products/import-source");
  const { productImportSources } = await import("../src/lib/products/import-source");

  const getProductMasterPage = (productsModule as Record<string, unknown>).getProductMasterPage as
    | ((
        organizationId: string,
        clinicId: string,
        params: ProductMasterPageParams,
      ) => Promise<{
        rows: ProductRowLike[];
        total: number;
        page: number;
        pageSize: number;
        pageCount: number;
      }>)
    | undefined;

  if (typeof getProductMasterPage !== "function") {
    throw new Error(
      "getProductMasterPage が未実装です。docs/codex-handoff-list-performance.md の契約に従って src/lib/db/products.ts に実装してください。",
    );
  }

  function applyCurrentFilters(rows: ProductRowLike[], params: ProductMasterPageParams) {
    const { q, category, source } = params;

    return rows.filter((row) => {
      // 現行 products/page.tsx の searchText（barcodes/supplierName 等も含むが、本テストの seed では name 等で十分）
      const searchText = [row.name, row.productCode, row.janCode, row.category, row.manufacturer]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery = q ? searchText.includes(q.toLowerCase()) : true;
      const matchesCategory = category ? row.category === category : true;
      const matchesSource = source === "purchase-history" ? isPurchaseHistoryImportSource(row.importSource) : true;

      return matchesQuery && matchesCategory && matchesSource;
    });
  }

  try {
    const organization = await prisma.organization.create({
      data: { name: "Product Master Page Test Organization" },
    });
    const clinic = await prisma.clinic.create({
      data: { organizationId: organization.id, name: "Product Master Page Test Clinic" },
    });

    const seed = [
      { name: "アルファ材", code: "PM-001", category: "充填", importSource: null as string | null },
      { name: "ベータ材", code: "PM-002", category: "充填", importSource: productImportSources.purchaseHistory },
      { name: "ガンマ材", code: "PM-003", category: "印象", importSource: null },
      { name: "デルタ材", code: "PM-004", category: "印象", importSource: productImportSources.purchaseHistory },
      { name: "イプシロン材", code: "PM-005", category: "接着", importSource: null },
    ];

    for (const item of seed) {
      await prisma.product.create({
        data: {
          organizationId: organization.id,
          name: item.name,
          productCode: item.code,
          category: item.category,
          defaultMinStock: 1,
          importSource: item.importSource,
        },
      });
    }

    const allRows = (await getProductMasterRows(organization.id, clinic.id)) as unknown as ProductRowLike[];
    assert.equal(allRows.length, seed.length, "seed と getProductMasterRows の件数が一致すること");

    // ---- フィルタ同値（全件比較） ----
    const filterCases: ProductMasterPageParams[] = [
      {},
      { q: "ガンマ" },
      { q: "pm-002" }, // productCode 大文字小文字無視
      { category: "印象" },
      { source: "purchase-history" },
    ];

    for (const params of filterCases) {
      const oracle = applyCurrentFilters(allRows, params);
      const result = await getProductMasterPage(organization.id, clinic.id, { ...params, page: 1, pageSize: 1000 });

      assert.deepEqual(idsOf(result.rows), idsOf(oracle), `フィルタ同値（順序込み）: ${JSON.stringify(params)}`);
      assert.equal(result.total, oracle.length, `total が一致: ${JSON.stringify(params)}`);
    }

    // 購入履歴のみ = ベータ材 / デルタ材
    const purchaseOnly = await getProductMasterPage(organization.id, clinic.id, {
      source: "purchase-history",
      page: 1,
      pageSize: 1000,
    });
    assert.equal(purchaseOnly.total, 2, "購入履歴のみは2件");

    // ---- ページネーション ----
    const pageSize = 2;
    const oracleAll = applyCurrentFilters(allRows, {});
    const expectedPageCount = Math.max(1, Math.ceil(oracleAll.length / pageSize));

    const page1 = await getProductMasterPage(organization.id, clinic.id, { page: 1, pageSize });
    const page2 = await getProductMasterPage(organization.id, clinic.id, { page: 2, pageSize });
    const page3 = await getProductMasterPage(organization.id, clinic.id, { page: 3, pageSize });

    assert.equal(page1.total, oracleAll.length, "total は総件数");
    assert.equal(page1.pageCount, expectedPageCount, "pageCount が正しい");
    assert.deepEqual(idsOf(page1.rows), idsOf(oracleAll.slice(0, 2)), "1ページ目のスライス");
    assert.deepEqual(idsOf(page2.rows), idsOf(oracleAll.slice(2, 4)), "2ページ目のスライス");
    assert.deepEqual(idsOf(page3.rows), idsOf(oracleAll.slice(4, 6)), "3ページ目のスライス");

    const outOfRange = await getProductMasterPage(organization.id, clinic.id, { page: 999, pageSize });
    assert.deepEqual(idsOf(outOfRange.rows), [], "範囲外ページは空配列");
    assert.equal(outOfRange.total, oracleAll.length, "範囲外でも total は維持");

    console.log("product-master-page.test.ts: OK");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
