import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/ui/page-shell";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getActiveStaffOperatorOptionsForClinic } from "@/lib/db/staff-operators";
import { getCategories, getStockPage } from "@/lib/db/stock";
import { InventoryAdjustCell } from "./inventory-adjust-cell";
import { InventoryFilterForm } from "./inventory-filter-form";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    category?: string;
    shortage?: string;
    page?: string;
  }>;
};

function parsePage(value: string | undefined) {
  const page = Number(value);

  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function buildInventoryPageHref(params: { q: string; category: string; shortageOnly: boolean }, page: number) {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set("q", params.q);
  }
  if (params.category) {
    searchParams.set("category", params.category);
  }
  if (params.shortageOnly) {
    searchParams.set("shortage", "1");
  }
  if (page > 1) {
    searchParams.set("page", String(page));
  }

  const queryString = searchParams.toString();

  return queryString ? `/inventory?${queryString}` : "/inventory";
}

export default async function InventoryPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const category = params.category ?? "";
  const shortageOnly = params.shortage === "1";
  const page = parsePage(params.page);
  const [stockPage, categories, staffOperators] = await Promise.all([
    getStockPage(context.clinicId, {
      q: query,
      category,
      shortageOnly,
      page,
    }),
    getCategories(context.clinicId),
    getActiveStaffOperatorOptionsForClinic({
      organizationId: context.organizationId,
      clinicId: context.clinicId,
    }),
  ]);
  const filteredRows = stockPage.rows;
  if (page > stockPage.pageCount) {
    redirect(buildInventoryPageHref({ q: query, category, shortageOnly }, stockPage.pageCount));
  }

  const previousHref = buildInventoryPageHref({ q: query, category, shortageOnly }, stockPage.page - 1);
  const nextHref = buildInventoryPageHref({ q: query, category, shortageOnly }, stockPage.page + 1);

  return (
    <PageShell current="inventory" mainClassName="px-3 pt-3 pb-6 lg:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">

        <PageHeader title={"在庫一覧"}>
          <a className="inline-flex h-11 shrink-0 items-center justify-center rounded btn-secondary px-4 text-sm font-semibold transition" href="/home">
            ホームへ戻る
          </a>
        </PageHeader>


        <InventoryFilterForm
          categories={categories}
          defaultQuery={query}
          defaultCategory={category}
          defaultShortageOnly={shortageOnly}
        />

        <section className="overflow-hidden rounded border border-line bg-panel shadow-sheet">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
            <span>
              表示 {filteredRows.length} 件 / 全 {stockPage.total} 件
            </span>
            <div className="flex items-center gap-2">
              <a
                className={`rounded btn-secondary px-3 py-1.5 text-xs font-semibold transition ${
                  stockPage.page <= 1 ? "pointer-events-none bg-subtle text-muted" : ""
                }`}
                href={previousHref}
                aria-disabled={stockPage.page <= 1}
              >
                前へ
              </a>
              <span className="text-xs">
                {stockPage.page} / {stockPage.pageCount}
              </span>
              <a
                className={`rounded btn-secondary px-3 py-1.5 text-xs font-semibold transition ${
                  stockPage.page >= stockPage.pageCount
                    ? "pointer-events-none bg-subtle text-muted"
                    : ""
                }`}
                href={nextHref}
                aria-disabled={stockPage.page >= stockPage.pageCount}
              >
                次へ
              </a>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] border-collapse text-left text-sm">
              <thead className="bg-tint text-label text-accent">
                <tr>
                  <th className="border-b border-accent px-4 py-3">商品</th>
                  <th className="border-b border-accent px-4 py-3">カテゴリ</th>
                  <th className="border-b border-accent px-4 py-3 text-right">現在庫</th>
                  <th className="border-b border-accent px-4 py-3 text-right">最低在庫</th>
                  <th className="border-b border-accent px-4 py-3">ステータス</th>
                  <th className="border-b border-accent px-4 py-3">保管場所</th>
                  <th className="border-b border-accent px-4 py-3">数量編集</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.stockItemId} className="align-top">
                    <td className="border-b border-line px-4 py-3">
                      <a className="font-semibold text-accent hover:underline" href={`/products/${row.productId}`}>
                        {row.name}
                      </a>
                      <p className="mt-1 text-xs text-muted">
                        {row.productCode}
                      </p>
                    </td>
                    <td className="border-b border-line px-4 py-3">{row.category ?? "-"}</td>
                    <td className="border-b border-line px-4 py-3 text-right text-lg font-semibold">
                      {row.quantity}
                      {row.stockUsageMode === "IN_USE" ? (
                        <span className="mt-1 block text-xs font-semibold text-muted">
                          使用中 {row.inUseQuantity} / 総数 {row.totalQuantity} / 廃棄済み累計 {row.discardedQuantity}
                        </span>
                      ) : null}
                    </td>
                    <td className="border-b border-line px-4 py-3 text-right">{row.minStock}</td>
                    <td className="border-b border-line px-4 py-3">
                      <span className={`rounded px-2 py-1 text-label font-semibold ${row.stockStatusClassName}`}>
                        {row.stockStatusLabel}
                      </span>
                    </td>
                    <td className="border-b border-line px-4 py-3">{row.location ?? "-"}</td>
                    <td className="border-b border-line px-4 py-3">
                      <InventoryAdjustCell
                        stockItemId={row.stockItemId}
                        quantity={row.quantity}
                        stockUpdatedAt={row.stockUpdatedAt}
                        clinicId={context.clinicId}
                        staffOperators={staffOperators}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
