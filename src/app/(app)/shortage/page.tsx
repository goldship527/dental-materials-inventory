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
  const renderShortageRow = (row: StockRow) => {
    const pendingOrders = pendingOrdersByProduct[row.productId];
    const hasPendingOrders = Boolean(pendingOrders && pendingOrders.totalQuantity > 0);

    return (
      <tr key={row.stockItemId} className="print:break-inside-avoid">
        <td className="border-b border-line px-4 py-3 print:border print:border-black print:px-2 print:py-1.5">
          <a
            className="font-semibold text-accent hover:underline print:text-black print:no-underline"
            href={`/products/${row.productId}`}
          >
            {row.name}
          </a>
          <p className="mt-1 text-xs text-muted print:mt-0.5 print:text-[9px] print:text-black">
            {row.productCode} / {row.category ?? "未分類"}
          </p>
        </td>
        <td className="border-b border-line px-4 py-3 text-right font-semibold print:border print:border-black print:px-2 print:py-1.5">
          {row.quantity}
        </td>
        <td className="border-b border-line px-4 py-3 text-right print:border print:border-black print:px-2 print:py-1.5">
          {row.minStock}
        </td>
        <td className="border-b border-line px-4 py-3 text-right text-danger print:border print:border-black print:px-2 print:py-1.5 print:font-semibold print:text-black">
          {row.shortageCount}
        </td>
        <td className="border-b border-line px-4 py-3 print:border print:border-black print:px-2 print:py-1.5">
          {row.supplierId && row.supplierName ? (
            <a
              className="text-accent hover:underline print:text-black print:no-underline"
              href={`/suppliers/${row.supplierId}`}
            >
              {row.supplierName}
            </a>
          ) : (
            "-"
          )}
        </td>
        <td className="border-b border-line px-4 py-3 text-right print:border print:border-black print:px-2 print:py-1.5">
          {hasPendingOrders && pendingOrders ? (
            <div>
              <p className="font-semibold text-accent print:text-black">{pendingOrders.totalQuantity}個</p>
              <p className="mt-1 text-xs text-muted print:text-[9px] print:text-black">
                最終 {pendingOrders.latestOrderedAt ? dateFormatter.format(pendingOrders.latestOrderedAt) : "-"}
              </p>
            </div>
          ) : (
            "-"
          )}
        </td>
        <td className="border-b border-line px-4 py-3 print:hidden">
          <ShortageOrderButton
            stockItemId={row.stockItemId}
            isAlreadyAdded={activeOrderProductIds.has(row.productId) || hasPendingOrders}
            pendingQuantity={pendingOrders?.totalQuantity ?? 0}
          />
        </td>
        <td className="hidden border border-black px-2 py-1.5 print:table-cell" />
      </tr>
    );
  };
  const renderEmptyRow = () => (
    <tr>
      <td
        className="px-4 py-12 text-center text-muted print:border print:border-black print:px-2 print:py-6 print:text-black"
        colSpan={8}
      >
        {emptyMessage}
      </td>
    </tr>
  );

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink print:bg-white print:p-0 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 print:max-w-none print:gap-3">
        <AppNav current="shortage" />

        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between print:border-black print:pb-3">
          <div>
            <p className="text-sm font-semibold text-accent print:text-black">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold print:text-2xl">不足在庫一覧</h1>
            <p className="mt-2 text-sm text-muted print:text-xs print:text-black">
              発行日時: {generatedAt}
            </p>
          </div>
          <div className="flex gap-3 print:hidden">
            <a className="rounded border border-line px-5 py-3 text-sm font-semibold hover:border-accent" href="/home">
              ホームへ戻る
            </a>
            <PrintButton />
          </div>
        </header>


        <form className="grid gap-3 rounded border border-line bg-white p-4 shadow-panel md:grid-cols-[1fr_auto_auto] print:hidden">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="商品名・商品コード・JAN・カテゴリ・発注先"
            className="h-11 rounded border border-line px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="submit"
            className="h-11 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            検索
          </button>
          <a
            className="flex h-11 items-center justify-center rounded border border-line px-5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            href="/shortage"
          >
            クリア
          </a>
        </form>

        <section className="hidden grid-cols-3 gap-3 text-xs print:grid">
          <div className="border border-black px-3 py-2">確認者</div>
          <div className="border border-black px-3 py-2">発注確認</div>
          <div className="border border-black px-3 py-2">備考</div>
        </section>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel print:rounded-none print:border-black print:shadow-none">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm text-muted print:border-black print:px-2 print:py-2 print:text-xs print:text-black">
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
                className={`rounded border border-line px-3 py-1.5 text-xs font-semibold transition ${
                  page <= 1 ? "pointer-events-none text-muted/50" : "text-muted hover:border-accent hover:text-accent"
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
                className={`rounded border border-line px-3 py-1.5 text-xs font-semibold transition ${
                  page >= shortagePageCount ? "pointer-events-none text-muted/50" : "text-muted hover:border-accent hover:text-accent"
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
            <div className="hidden border-b border-black px-2 py-1.5 text-xs text-black print:block">
              出力条件: 検索 {query}
            </div>
          ) : null}
          <table className="w-full border-collapse text-left text-sm print:text-[10.5px]">
            <thead className="bg-gray-50 text-xs text-muted print:bg-white print:text-[10px] print:text-black">
              <tr>
                <th className="border-b border-line px-4 py-3 print:border print:border-black print:px-2 print:py-1.5">
                  商品名
                </th>
                <th className="border-b border-line px-4 py-3 text-right print:border print:border-black print:px-2 print:py-1.5">
                  現在庫
                </th>
                <th className="border-b border-line px-4 py-3 text-right print:border print:border-black print:px-2 print:py-1.5">
                  最低在庫
                </th>
                <th className="border-b border-line px-4 py-3 text-right print:border print:border-black print:px-2 print:py-1.5">
                  不足数
                </th>
                <th className="border-b border-line px-4 py-3 print:border print:border-black print:px-2 print:py-1.5">
                  発注先
                </th>
                <th className="border-b border-line px-4 py-3 text-right print:border print:border-black print:px-2 print:py-1.5">
                  納品待ち
                </th>
                <th className="border-b border-line px-4 py-3 print:hidden">発注候補</th>
                <th className="hidden border border-black px-2 py-1.5 print:table-cell">確認</th>
              </tr>
            </thead>
            <tbody className="print:hidden">
              {pagedShortageRows.length > 0 ? pagedShortageRows.map(renderShortageRow) : renderEmptyRow()}
            </tbody>
            <tbody className="hidden print:table-row-group">
              {filteredShortageRows.length > 0 ? filteredShortageRows.map(renderShortageRow) : renderEmptyRow()}
            </tbody>
          </table>
        </section>

        <p className="hidden text-[10px] text-black print:block">
          在庫棚と照合してください。
        </p>
      </div>
    </main>
  );
}
