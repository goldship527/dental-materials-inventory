import assert from "node:assert/strict";
import { resetTestDatabase } from "./helpers/db";

// 目的:
//   docs/codex-handoff-list-performance.md の契約「getStockPage」に対する red テスト。
//   getStockPage(clinicId, params).rows が、getStockRows(clinicId) + 現行 inventory/page.tsx の
//   絞り込みを掛けてページスライスしたもの（オラクル）と「同値」であることを検証する。
//   getStockPage 未実装の間は失敗（red）。実装後に green になる。

type StockRowLike = {
  stockItemId: string;
  name: string;
  productCode: string | null;
  janCode: string | null;
  category: string | null;
  manufacturer: string | null;
  isShortage: boolean;
};

type StockPageParams = {
  q?: string;
  category?: string;
  shortageOnly?: boolean;
  page?: number;
  pageSize?: number;
};

function applyCurrentFilters(rows: StockRowLike[], params: StockPageParams) {
  const { q, category, shortageOnly } = params;

  return rows.filter((row) => {
    const searchText = [row.name, row.productCode, row.janCode, row.category, row.manufacturer]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = q ? searchText.includes(q.toLowerCase()) : true;
    const matchesCategory = category ? row.category === category : true;
    const matchesShortage = shortageOnly ? row.isShortage : true;

    return matchesQuery && matchesCategory && matchesShortage;
  });
}

function idsOf(rows: StockRowLike[]) {
  return rows.map((row) => row.stockItemId);
}

async function main() {
  resetTestDatabase();

  const { prisma } = await import("../src/lib/db/prisma");
  const stockModule = await import("../src/lib/db/stock");
  const { getStockRows } = stockModule;
  const getStockPage = (stockModule as Record<string, unknown>).getStockPage as
    | ((clinicId: string, params: StockPageParams) => Promise<{
        rows: StockRowLike[];
        total: number;
        page: number;
        pageSize: number;
        pageCount: number;
      }>)
    | undefined;

  if (typeof getStockPage !== "function") {
    throw new Error(
      "getStockPage が未実装です。docs/codex-handoff-list-performance.md の契約に従って src/lib/db/stock.ts に実装してください。",
    );
  }

  try {
    const organization = await prisma.organization.create({
      data: { name: "Stock Page Test Organization" },
    });
    const clinic = await prisma.clinic.create({
      data: { organizationId: organization.id, name: "Stock Page Test Clinic" },
    });

    // 在庫状態を作り分ける（不足/ぎりぎり/十分、minStock=null のフォールバックも含む）
    const seed = [
      { name: "アルファ", code: "SP-001", jan: "4900000000001", category: "材料A", maker: "MakerX", quantity: 0, minStock: 3 },
      { name: "ベータ", code: "SP-002", jan: "4900000000002", category: "材料A", maker: "MakerY", quantity: 2, minStock: 5 },
      { name: "ガンマ", code: "SP-003", jan: "4900000000003", category: "材料B", maker: "MakerZ", quantity: 5, minStock: 5 },
      { name: "デルタ", code: "SP-004", jan: "4900000000004", category: "材料B", maker: "MakerX", quantity: 10, minStock: 3 },
      // minStock を null にして product.defaultMinStock(4) からのフォールバックで不足になるケース
      { name: "イプシロン", code: "SP-005", jan: "4900000000005", category: "材料C", maker: "MakerY", quantity: 1, minStock: null as number | null, defaultMinStock: 4 },
    ];

    for (const item of seed) {
      const product = await prisma.product.create({
        data: {
          organizationId: organization.id,
          name: item.name,
          productCode: item.code,
          janCode: item.jan,
          category: item.category,
          manufacturer: item.maker,
          defaultMinStock: item.defaultMinStock ?? 1,
        },
      });

      await prisma.stockItem.create({
        data: {
          clinicId: clinic.id,
          productId: product.id,
          quantity: item.quantity,
          minStock: item.minStock,
          isUsed: true,
        },
      });
    }

    const allRows = (await getStockRows(clinic.id)) as unknown as StockRowLike[];
    assert.equal(allRows.length, seed.length, "seed と getStockRows の件数が一致すること");

    // ---- フィルタ同値（ページサイズを大きくして全件比較） ----
    const filterCases: StockPageParams[] = [
      {},
      { q: "ベ" },
      { q: "makerx" }, // 大文字小文字無視 + manufacturer 検索
      { q: "SP-003" }, // productCode 検索
      { category: "材料A" },
      { shortageOnly: true },
      { category: "材料B", shortageOnly: true },
    ];

    for (const params of filterCases) {
      const oracle = applyCurrentFilters(allRows, params);
      const result = await getStockPage(clinic.id, { ...params, page: 1, pageSize: 1000 });

      assert.deepEqual(
        idsOf(result.rows),
        idsOf(oracle),
        `フィルタ同値（順序込み）: ${JSON.stringify(params)}`,
      );
      assert.equal(result.total, oracle.length, `total が一致: ${JSON.stringify(params)}`);
    }

    // 不足のみ = アルファ(0<3) / ベータ(2<5) / イプシロン(1<4 フォールバック)
    const shortageOnly = await getStockPage(clinic.id, { shortageOnly: true, page: 1, pageSize: 1000 });
    assert.equal(shortageOnly.total, 3, "不足のみは3件（minStock=null のフォールバック含む）");

    // ---- ページネーション ----
    const pageSize = 2;
    const oracleAll = applyCurrentFilters(allRows, {});
    const expectedPageCount = Math.max(1, Math.ceil(oracleAll.length / pageSize));

    const page1 = await getStockPage(clinic.id, { page: 1, pageSize });
    const page2 = await getStockPage(clinic.id, { page: 2, pageSize });
    const page3 = await getStockPage(clinic.id, { page: 3, pageSize });

    assert.equal(page1.total, oracleAll.length, "page1.total は総件数");
    assert.equal(page1.pageCount, expectedPageCount, "pageCount が正しい");
    assert.equal(page1.pageSize, pageSize, "pageSize がそのまま返る");

    assert.deepEqual(idsOf(page1.rows), idsOf(oracleAll.slice(0, 2)), "1ページ目のスライス");
    assert.deepEqual(idsOf(page2.rows), idsOf(oracleAll.slice(2, 4)), "2ページ目のスライス");
    assert.deepEqual(idsOf(page3.rows), idsOf(oracleAll.slice(4, 6)), "3ページ目のスライス");

    // ---- 範囲外ページは空配列、ただし total/pageCount は維持 ----
    const outOfRange = await getStockPage(clinic.id, { page: 999, pageSize });
    assert.deepEqual(idsOf(outOfRange.rows), [], "範囲外ページは空配列");
    assert.equal(outOfRange.total, oracleAll.length, "範囲外でも total は維持");
    assert.equal(outOfRange.pageCount, expectedPageCount, "範囲外でも pageCount は維持");

    console.log("stock-page.test.ts: OK");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
