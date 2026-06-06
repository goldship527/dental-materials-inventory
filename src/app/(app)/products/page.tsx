import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { isAdminRole } from "@/lib/auth/roles";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getProductCategories, getProductMasterPage, getPurchaseHistoryProductSummary } from "@/lib/db/products";
import { isPurchaseHistoryImportSource } from "@/lib/products/import-source";
import { ProductFilterForm } from "./product-filter-form";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    category?: string;
    attachBarcode?: string;
    source?: string;
    setup?: string;
    adminDenied?: string;
    page?: string;
  }>;
};

function parsePage(value: string | undefined) {
  const page = Number(value);

  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function buildProductsPageHref(
  params: { q: string; category: string; source: string; setup: string; attachBarcode: string },
  page: number,
) {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set("q", params.q);
  }
  if (params.category) {
    searchParams.set("category", params.category);
  }
  if (params.source) {
    searchParams.set("source", params.source);
  }
  if (params.setup) {
    searchParams.set("setup", params.setup);
  }
  if (params.attachBarcode) {
    searchParams.set("attachBarcode", params.attachBarcode);
  }
  if (page > 1) {
    searchParams.set("page", String(page));
  }

  const queryString = searchParams.toString();

  return queryString ? `/products?${queryString}` : "/products";
}

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function formatPrice(value: number | null) {
  return value === null ? "-" : yenFormatter.format(value);
}

function formatBarcodeLabel(barcode: { barcodeType: string; unitLabel: string | null; isPrimary: boolean }) {
  const pieces = [barcode.barcodeType, barcode.unitLabel, barcode.isPrimary ? "代表" : ""].filter(Boolean);

  return pieces.join(" / ");
}

function needsInitialSetup(row: { category: string | null; hasStockItem: boolean; minStock: number; location: string | null }) {
  return !row.hasStockItem || !row.category || row.category === "未分類" || row.minStock === 0 || !row.location;
}

function getAbcRankBadgeText(rank: string) {
  if (rank === "UNUSED") {
    return "過去90日出庫なし";
  }

  return `使用頻度 ${rank}`;
}

function getAbcRankBadgeClass(rank: string) {
  if (rank === "A") {
    return "border-emerald-200 bg-emerald-50 text-accent";
  }

  if (rank === "B") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (rank === "C") {
    return "border-gray-200 bg-gray-50 text-muted";
  }

  return "border-line bg-white text-muted";
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const canManageProducts = isAdminRole(session.user.role);
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const category = params.category ?? "";
  const attachBarcode = params.attachBarcode?.trim() ?? "";
  const source = params.source ?? "";
  const setup = params.setup ?? "";
  const page = parsePage(params.page);
  const [productPage, categories, purchaseHistorySummary] = await Promise.all([
    getProductMasterPage(context.organizationId, context.clinicId, {
      q: query,
      category,
      source,
      setup,
      page,
    }),
    getProductCategories(context.organizationId),
    getPurchaseHistoryProductSummary(context.organizationId, context.clinicId),
  ]);
  const filteredRows = productPage.rows;
  if (page > productPage.pageCount) {
    redirect(buildProductsPageHref({ q: query, category, source, setup, attachBarcode }, productPage.pageCount));
  }

  const previousHref = buildProductsPageHref({ q: query, category, source, setup, attachBarcode }, productPage.page - 1);
  const nextHref = buildProductsPageHref({ q: query, category, source, setup, attachBarcode }, productPage.page + 1);
  const filterLabel = [
    query ? `検索: ${query}` : "",
    category ? `カテゴリ: ${category}` : "",
    source === "purchase-history" ? "購入履歴から登録" : "",
    setup === "1" ? "初期設定が必要" : "",
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppNav current="products" />

        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">商品マスタ</h1>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap">
            {canManageProducts && !attachBarcode ? (
              <>
                <a
                  className="inline-flex min-h-11 items-center justify-center rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                  href="/products/new"
                >
                  商品を新規作成
                </a>
                <a
                  className="inline-flex min-h-11 items-center justify-center rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                  href="/products/import"
                >
                  一括取り込み
                </a>
              </>
            ) : null}
            <a
              className="inline-flex min-h-11 items-center justify-center rounded border border-line px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              href="/home"
            >
              ホームへ戻る
            </a>
          </div>
        </header>

        {params.adminDenied ? (
          <section className="rounded border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-semibold text-warning shadow-panel">
            商品マスタの作成・編集は管理者専用です。必要な場合は管理者に依頼してください。
          </section>
        ) : null}


        <ProductFilterForm
          categories={categories}
          defaultQuery={query}
          defaultCategory={category}
          attachBarcode={attachBarcode}
          source={source}
          setup={setup}
        />

        {!attachBarcode && purchaseHistorySummary.total > 0 ? (
          <section className="rounded border border-line bg-white p-4 text-sm shadow-panel">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-ink">購入履歴から登録した商品</p>
                <p className="mt-1 text-muted">
                  {purchaseHistorySummary.total}件中、{purchaseHistorySummary.needsSetup}件はカテゴリ、最低在庫、保管場所などの確認が残っています。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  className="inline-flex min-h-10 items-center justify-center rounded border border-line px-3 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                  href="/products?source=purchase-history"
                >
                  登録商品を見る
                </a>
                {canManageProducts ? (
                  <a
                    className="inline-flex min-h-10 items-center justify-center rounded bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                    href="/products/import/purchase-history/setup"
                  >
                    まとめて整える
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {attachBarcode ? (
          <section className="rounded border border-warning/30 bg-yellow-50 p-4 text-sm text-warning shadow-panel">
            <p className="font-semibold">紐づける商品を選択中</p>
            <p className="mt-2">
              読み取ったバーコード <span className="font-mono text-ink">{attachBarcode}</span>{" "}
              を紐づけます。
            </p>
          </section>
        ) : null}

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
            <span>
              表示 {filteredRows.length} 件 / 全 {productPage.total} 件
              {filterLabel ? `（${filterLabel}）` : ""}
            </span>
            <div className="flex items-center gap-2">
              <a
                className={`rounded border border-line px-3 py-1.5 text-xs font-semibold transition ${
                  productPage.page <= 1 ? "pointer-events-none text-muted/50" : "text-muted hover:border-accent hover:text-accent"
                }`}
                href={previousHref}
                aria-disabled={productPage.page <= 1}
              >
                前へ
              </a>
              <span className="text-xs">
                {productPage.page} / {productPage.pageCount}
              </span>
              <a
                className={`rounded border border-line px-3 py-1.5 text-xs font-semibold transition ${
                  productPage.page >= productPage.pageCount
                    ? "pointer-events-none text-muted/50"
                    : "text-muted hover:border-accent hover:text-accent"
                }`}
                href={nextHref}
                aria-disabled={productPage.page >= productPage.pageCount}
              >
                次へ
              </a>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1440px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">商品</th>
                  <th className="border-b border-line px-4 py-3 text-right">現在庫</th>
                  <th className="border-b border-line px-4 py-3 text-right">納品待ち</th>
                  <th className="border-b border-line px-4 py-3 text-right">最低在庫</th>
                  <th className="border-b border-line px-4 py-3">保管場所</th>
                  <th className="border-b border-line px-4 py-3">カテゴリ</th>
                  <th className="border-b border-line px-4 py-3">主発注先</th>
                  <th className="border-b border-line px-4 py-3">発注単位</th>
                  <th className="border-b border-line px-4 py-3 text-right">標準価格</th>
                  <th className="border-b border-line px-4 py-3">メーカー</th>
                  <th className="border-b border-line px-4 py-3">規格</th>
                  <th className="border-b border-line px-4 py-3">バーコード</th>
                  {canManageProducts && attachBarcode ? <th className="border-b border-line px-4 py-3">紐づけ</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="border-b border-line px-4 py-3">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${getAbcRankBadgeClass(row.abcRank.rank)}`}>
                            {getAbcRankBadgeText(row.abcRank.rank)}
                          </span>
                          {row.abcRank.rank !== "UNUSED" ? (
                            <span className="text-xs text-muted">90日出庫 {row.abcRank.totalQuantity}</span>
                          ) : null}
                        </div>
                        <a className="font-semibold text-accent hover:underline" href={`/products/${row.id}`}>
                          {row.name}
                        </a>
                        <p className="mt-1 text-xs text-muted">
                          {row.productCode ?? "コード未設定"} / JAN {row.janCode ?? "-"}
                        </p>
                        {canManageProducts && isPurchaseHistoryImportSource(row.importSource) ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="inline-flex rounded bg-teal-50 px-2 py-1 text-xs font-semibold text-accent">
                              購入履歴から登録
                            </span>
                            {needsInitialSetup(row) ? (
                              <a
                                className="inline-flex rounded border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-semibold text-warning transition hover:border-warning"
                                href={`/products/${row.id}/edit`}
                              >
                                設定を整える
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="border-b border-line px-4 py-3 text-right font-semibold">
                        {row.currentQuantity}
                      </td>
                      <td className="border-b border-line px-4 py-3 text-right">
                        {row.pendingOrders.totalQuantity > 0 ? (
                          <span className="font-semibold text-accent">{row.pendingOrders.totalQuantity}個</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="border-b border-line px-4 py-3 text-right">
                        <p className="font-semibold">{row.minStock}</p>
                        {row.recommendedMinStock.recommended !== null ? (
                          <p className="mt-1 text-xs font-semibold text-accent">推奨 {row.recommendedMinStock.recommended}</p>
                        ) : (
                          <p className="mt-1 text-xs text-muted">推奨: データ不足</p>
                        )}
                      </td>
                      <td className="border-b border-line px-4 py-3">{row.location ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3">{row.category ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3">
                        {row.supplierId && row.supplierName ? (
                          <a className="font-semibold text-accent hover:underline" href={`/suppliers/${row.supplierId}`}>
                            {row.supplierName}
                          </a>
                        ) : (
                          <p>-</p>
                        )}
                        {row.supplierProductCode ? (
                          <p className="mt-1 text-xs text-muted">{row.supplierProductCode}</p>
                        ) : null}
                      </td>
                      <td className="border-b border-line px-4 py-3">{row.orderUnit ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3 text-right">{formatPrice(row.standardPrice)}</td>
                      <td className="border-b border-line px-4 py-3">{row.manufacturer ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3">{row.specification ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3">
                        {row.barcodes.length > 0 ? (
                          <div className="grid gap-1">
                            {row.barcodes.slice(0, 2).map((barcode) => (
                              <div key={`${row.id}-${barcode.barcode}`}>
                                <p className="font-mono text-xs">{barcode.barcode}</p>
                                <p className="text-xs text-muted">{formatBarcodeLabel(barcode)}</p>
                              </div>
                            ))}
                            {row.barcodes.length > 2 ? (
                              <p className="text-xs text-muted">ほか {row.barcodes.length - 2} 件</p>
                            ) : null}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      {canManageProducts && attachBarcode ? (
                        <td className="border-b border-line px-4 py-3">
                          <a
                            className="inline-flex min-h-11 items-center justify-center rounded bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800"
                            href={`/products/${row.id}/edit?newBarcode=${encodeURIComponent(attachBarcode)}`}
                          >
                            この商品に紐づける
                          </a>
                        </td>
                      ) : null}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted" colSpan={canManageProducts && attachBarcode ? 13 : 12}>
                      条件に一致する商品はありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
