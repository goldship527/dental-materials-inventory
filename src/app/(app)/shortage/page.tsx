import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getActiveOrderRequestProductIds } from "@/lib/db/orders";
import { getPendingOrderDetailsByProduct } from "@/lib/db/pending-orders";
import { getStockRows, type StockRow } from "@/lib/db/stock";
import { PrintButton } from "./print-button";
import { ShortageOrderButton } from "./shortage-order-button";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    page?: string;
  }>;
};

const shortagePageSize = 50;

function parsePage(value: string | undefined) {
  const page = Number(value);

  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function buildShortagePageHref(params: { q: string }, page: number) {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set("q", params.q);
  }
  if (page > 1) {
    searchParams.set("page", String(page));
  }

  const queryString = searchParams.toString();

  return queryString ? `/shortage?${queryString}` : "/shortage";
}

export default async function ShortagePage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const page = parsePage(params.page);
  const normalizedQuery = query.toLowerCase();
  const [rows, activeOrderProductIds, pendingOrdersByProduct] = await Promise.all([
    getStockRows(context.clinicId),
    getActiveOrderRequestProductIds(context.clinicId),
    getPendingOrderDetailsByProduct(context.organizationId, context.clinicId),
  ]);
  const shortageRows = rows
    .filter((row) => row.isShortage)
    .sort(
      (a, b) =>
        Number(b.quantity === 0) - Number(a.quantity === 0) ||
        b.shortageCount - a.shortageCount ||
        a.name.localeCompare(b.name, "ja"),
    );
  const filteredShortageRows = shortageRows.filter((row) => {
    const searchText = [
      row.name,
      row.productCode,
      row.janCode,
      row.category,
      row.manufacturer,
      row.supplierName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return normalizedQuery ? searchText.includes(normalizedQuery) : true;
  });
  const generatedAt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const emptyMessage =
    shortageRows.length === 0
      ? "不足在庫はありません。"
      : "条件に一致する不足在庫はありません。検索語を見直してください。";
  const shortageTotal = filteredShortageRows.length;
  const shortagePageCount = Math.max(1, Math.ceil(shortageTotal / shortagePageSize));
  if (page > shortagePageCount) {
    redirect(buildShortagePageHref({ q: query }, shortagePageCount));
  }

  const pagedShortageRows = filteredShortageRows.slice((page - 1) * shortagePageSize, page * shortagePageSize);
  const previousHref = buildShortagePageHref({ q: query }, page - 1);
  const nextHref = buildShortagePageHref({ q: query }, page + 1);
  const renderShortageRow = (row: StockRow, options: { interactive: boolean } = { interactive: true }) => {
    const pendingOrders = pendingOrdersByProduct[row.productId];
    const hasPendingOrders = Boolean(pendingOrders && pendingOrders.totalQuantity > 0);

    return (
      <tr key={row.stockItemId} className="print:break-inside-avoid">
        <td className="border-b border-line px-4 py-3 print:border print:border-ink print:px-2 print:py-1.5">
          <a
            className="font-semibold text-accent hover:underline print:text-ink print:no-underline"
            href={`/products/${row.productId}`}
          >
            {row.name}
          </a>
          <p className="mt-1 text-xs text-muted print:mt-0.5 print:text-xs print:text-ink">
            {row.productCode} / {row.category ?? "未分類"}
          </p>
        </td>
        <td className="border-b border-line px-4 py-3 text-right font-semibold print:border print:border-ink print:px-2 print:py-1.5">
          {row.quantity}
        </td>
        <td className="border-b border-line px-4 py-3 text-right print:border print:border-ink print:px-2 print:py-1.5">
          {row.minStock}
        </td>
        <td className="border-b border-line px-4 py-3 text-right text-danger print:border print:border-ink print:px-2 print:py-1.5 print:font-semibold print:text-ink">
          {row.shortageCount}
        </td>
        <td className="border-b border-line px-4 py-3 print:border print:border-ink print:px-2 print:py-1.5">
          {row.supplierId && row.supplierName ? (
            <a
              className="text-accent hover:underline print:text-ink print:no-underline"
              href={`/suppliers/${row.supplierId}`}
            >
              {row.supplierName}
            </a>
          ) : (
            "-"
          )}
        </td>
        <td className="border-b border-line px-4 py-3 text-right print:border print:border-ink print:px-2 print:py-1.5">
          {hasPendingOrders && pendingOrders ? (
            <div>
              <p className="font-semibold text-accent print:text-ink">{pendingOrders.totalQuantity}個</p>
              <p className="mt-1 text-xs text-muted print:text-xs print:text-ink">
                最終 {pendingOrders.latestOrderedAt ? dateFormatter.format(pendingOrders.latestOrderedAt) : "-"}
              </p>
            </div>
          ) : (
            "-"
          )}
        </td>
        <td className="border-b border-line px-4 py-3 print:hidden">
          {options.interactive ? (
            <ShortageOrderButton
              stockItemId={row.stockItemId}
              isAlreadyAdded={activeOrderProductIds.has(row.productId) || hasPendingOrders}
              pendingQuantity={pendingOrders?.totalQuantity ?? 0}
            />
          ) : null}
        </td>
        <td className="hidden border border-ink px-2 py-1.5 print:table-cell" />
      </tr>
    );
  };
  const renderEmptyRow = () => (
    <tr>
      <td
        className="px-4 py-12 text-center text-muted print:border print:border-ink print:px-2 print:py-6 print:text-ink"
        colSpan={8}
      >
        {emptyMessage}
      </td>
    </tr>
  );

  return (
    <main className="min-h-screen bg-surface px-3 pt-3 pb-6 text-ink print:bg-panel print:p-0 lg:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 print:max-w-none print:gap-3">
        <AppNav current="shortage" />

        <PageHeader title={"不足在庫一覧"} className="print:border-b print:border-ink print:pb-3">
          <div>

            <p className="mt-2 text-sm text-muted print:text-xs print:text-ink">
              発行日時: {generatedAt}
            </p>
          </div>
          <div className="flex gap-3 print:hidden">
            <a className="rounded btn-secondary px-5 py-3 text-sm font-semibold" href="/home">
              ホームへ戻る
            </a>
            <PrintButton />
          </div>
        </PageHeader>


        <form className="grid gap-3 rounded border border-line bg-panel p-4 shadow-sheet md:grid-cols-[1fr_auto_auto] print:hidden">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="商品名・商品コード・カテゴリ・発注先"
            className="h-11 rounded border border-line px-3 text-sm    "
          />
          <button
            type="submit"
            className="h-11 rounded btn-primary px-5 text-sm font-semibold transition"
          >
            検索
          </button>
          <a
            className="flex h-11 items-center justify-center rounded btn-secondary px-5 text-sm font-semibold transition"
            href="/shortage"
          >
            クリア
          </a>
        </form>

        <section className="hidden grid-cols-2 gap-3 text-xs print:grid">
          <div className="border border-ink px-3 py-2">発注確認</div>
          <div className="border border-ink px-3 py-2">備考</div>
        </section>

        <section className="overflow-hidden rounded border border-line bg-panel shadow-sheet print:rounded-none print:border-ink print:shadow-none">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm text-muted print:border-ink print:px-2 print:py-2 print:text-xs print:text-ink">
            <span className="print:hidden">
              表示 {pagedShortageRows.length} 件 / 不足 {shortageTotal} 件
              {query ? `（検索: ${query}）` : ""}
            </span>
            <span className="hidden print:inline">
              不足 {shortageTotal} 件
              {query ? `（検索: ${query}）` : ""}
            </span>
            <div className="flex items-center gap-2 print:hidden">
              <a
                className={`rounded btn-secondary px-3 py-1.5 text-xs font-semibold transition ${
                  page <= 1 ? "pointer-events-none bg-subtle text-muted" : ""
                }`}
                href={previousHref}
                aria-disabled={page <= 1}
              >
                前へ
              </a>
              <span className="text-xs">
                {page} / {shortagePageCount}
              </span>
              <a
                className={`rounded btn-secondary px-3 py-1.5 text-xs font-semibold transition ${
                  page >= shortagePageCount ? "pointer-events-none bg-subtle text-muted" : ""
                }`}
                href={nextHref}
                aria-disabled={page >= shortagePageCount}
              >
                次へ
              </a>
            </div>
            <span className="hidden print:inline">一般歯科材料在庫管理システム</span>
          </div>
          {query ? (
            <div className="hidden border-b border-ink px-2 py-1.5 text-xs text-ink print:block">
              出力条件: 検索 {query}
            </div>
          ) : null}
          <table className="w-full border-collapse text-left text-sm print:text-xs">
            <thead className="bg-tint text-label text-accent print:bg-panel print:text-label print:text-ink">
              <tr>
                <th className="border-b border-accent px-4 py-3 print:border print:border-ink print:px-2 print:py-1.5">
                  商品名
                </th>
                <th className="border-b border-accent px-4 py-3 text-right print:border print:border-ink print:px-2 print:py-1.5">
                  現在庫
                </th>
                <th className="border-b border-accent px-4 py-3 text-right print:border print:border-ink print:px-2 print:py-1.5">
                  最低在庫
                </th>
                <th className="border-b border-accent px-4 py-3 text-right print:border print:border-ink print:px-2 print:py-1.5">
                  不足数
                </th>
                <th className="border-b border-accent px-4 py-3 print:border print:border-ink print:px-2 print:py-1.5">
                  発注先
                </th>
                <th className="border-b border-accent px-4 py-3 text-right print:border print:border-ink print:px-2 print:py-1.5">
                  納品待ち
                </th>
                <th className="border-b border-accent px-4 py-3 print:hidden">発注候補</th>
                <th className="hidden border border-ink px-2 py-1.5 print:table-cell">確認</th>
              </tr>
            </thead>
            <tbody className="print:hidden">
              {pagedShortageRows.length > 0
                ? pagedShortageRows.map((row) => renderShortageRow(row, { interactive: true }))
                : renderEmptyRow()}
            </tbody>
            <tbody className="hidden print:table-row-group">
              {filteredShortageRows.length > 0
                ? filteredShortageRows.map((row) => renderShortageRow(row, { interactive: false }))
                : renderEmptyRow()}
            </tbody>
          </table>
        </section>

        <p className="hidden text-xs text-ink print:block">
          在庫棚と照合してください。
        </p>
      </div>
    </main>
  );
}
