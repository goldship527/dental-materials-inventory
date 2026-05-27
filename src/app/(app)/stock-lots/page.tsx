import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import {
  getStockLotRows,
  isStockLotVisibleByFilter,
  normalizeStockLotFilter,
  type StockLotExpiryFilter,
  type StockLotRow,
} from "@/lib/db/stock-lots";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    filter?: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const filterLabels: Record<StockLotExpiryFilter, string> = {
  attention: "要確認",
  expired: "期限切れ",
  expiring: "30日以内",
  all: "すべて",
};

function formatExpiryDate(lot: StockLotRow) {
  if (lot.expiryDate) {
    return dateFormatter.format(lot.expiryDate);
  }

  return lot.expiryDateText || "-";
}

function formatDaysUntilExpiry(lot: StockLotRow) {
  if (lot.daysUntilExpiry === null) {
    return "-";
  }

  if (lot.daysUntilExpiry < 0) {
    return `${Math.abs(lot.daysUntilExpiry)}日超過`;
  }

  if (lot.daysUntilExpiry === 0) {
    return "本日";
  }

  return `残り${lot.daysUntilExpiry}日`;
}

function buildFilterHref(filter: StockLotExpiryFilter, query: string) {
  const params = new URLSearchParams();
  params.set("filter", filter);

  if (query) {
    params.set("q", query);
  }

  return `/stock-lots?${params.toString()}`;
}

export default async function StockLotsPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const selectedFilter = normalizeStockLotFilter(params.filter);
  const rows = await getStockLotRows(context.clinicId);
  const filteredRows = rows.filter((row) => {
    const searchText = [
      row.productName,
      row.productCode,
      row.janCode,
      row.category,
      row.manufacturer,
      row.lotNumber,
      row.expiryDateText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = query ? searchText.includes(query.toLowerCase()) : true;
    const matchesFilter = isStockLotVisibleByFilter(row.status, selectedFilter);

    return matchesQuery && matchesFilter;
  });
  const counts = rows.reduce(
    (result, row) => {
      result.all += 1;

      if (row.status === "expired") {
        result.expired += 1;
        result.attention += 1;
      }

      if (row.status === "expiring") {
        result.expiring += 1;
        result.attention += 1;
      }

      return result;
    },
    {
      attention: 0,
      expired: 0,
      expiring: 0,
      all: 0,
    } satisfies Record<StockLotExpiryFilter, number>,
  );

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppNav current="inventory" />

        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">期限ロット一覧</h1>
            <p className="mt-2 text-sm text-muted">在庫に保存されたロット番号と有効期限を、期限切れ・期限間近から確認します。</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            <a
              className="inline-flex h-11 items-center rounded border border-line px-4 text-muted transition hover:border-accent hover:text-accent"
              href="/inventory"
            >
              在庫一覧へ
            </a>
            <a
              className="inline-flex h-11 items-center rounded border border-line px-4 text-muted transition hover:border-accent hover:text-accent"
              href="/home"
            >
              ホームへ戻る
            </a>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">要確認</p>
            <p className={counts.attention > 0 ? "mt-2 text-3xl font-semibold text-warning" : "mt-2 text-3xl font-semibold"}>
              {counts.attention}
            </p>
            <p className="mt-2 text-sm text-muted">期限切れ + 30日以内</p>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">期限切れ</p>
            <p className={counts.expired > 0 ? "mt-2 text-3xl font-semibold text-danger" : "mt-2 text-3xl font-semibold"}>
              {counts.expired}
            </p>
            <p className="mt-2 text-sm text-muted">使用前に確認</p>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">30日以内</p>
            <p className={counts.expiring > 0 ? "mt-2 text-3xl font-semibold text-warning" : "mt-2 text-3xl font-semibold"}>
              {counts.expiring}
            </p>
            <p className="mt-2 text-sm text-muted">期限が近いロット</p>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">ロット別在庫</p>
            <p className="mt-2 text-3xl font-semibold">{counts.all}</p>
            <p className="mt-2 text-sm text-muted">数量が1以上のロット</p>
          </div>
        </section>

        <section className="rounded border border-line bg-white p-4 shadow-panel">
          <form className="grid gap-3 lg:grid-cols-[1fr_auto]" action="/stock-lots">
            <input type="hidden" name="filter" value={selectedFilter} />
            <label className="grid gap-2 text-sm font-semibold text-muted">
              検索
              <input
                className="h-11 rounded border border-line bg-white px-3 text-base font-normal text-ink outline-none transition placeholder:text-muted focus:border-accent"
                defaultValue={query}
                name="q"
                placeholder="商品名、商品コード、JAN、ロット番号"
                type="search"
              />
            </label>
            <button
              className="h-11 self-end rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
              type="submit"
            >
              絞り込む
            </button>
          </form>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {(Object.keys(filterLabels) as StockLotExpiryFilter[]).map((filter) => {
              const isCurrent = selectedFilter === filter;

              return (
                <a
                  key={filter}
                  aria-current={isCurrent ? "page" : undefined}
                  className={
                    isCurrent
                      ? "inline-flex h-10 shrink-0 items-center rounded border border-accent/30 bg-teal-50 px-3 text-sm font-semibold text-accent"
                      : "inline-flex h-10 shrink-0 items-center rounded border border-line px-3 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                  }
                  href={buildFilterHref(filter, query)}
                >
                  {filterLabels[filter]} {counts[filter]}
                </a>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="border-b border-line px-4 py-3 text-sm text-muted">
            表示 {filteredRows.length} 件 / 全 {rows.length} 件
          </div>
          {filteredRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead className="bg-gray-50 text-xs text-muted">
                  <tr>
                    <th className="border-b border-line px-4 py-3">商品</th>
                    <th className="border-b border-line px-4 py-3">ロット番号</th>
                    <th className="border-b border-line px-4 py-3">有効期限</th>
                    <th className="border-b border-line px-4 py-3">状態</th>
                    <th className="border-b border-line px-4 py-3 text-right">数量</th>
                    <th className="border-b border-line px-4 py-3">更新日時</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((lot) => (
                    <tr key={lot.id} className="align-top">
                      <td className="border-b border-line px-4 py-3">
                        <a className="font-semibold text-accent hover:underline" href={`/products/${lot.productId}`}>
                          {lot.productName}
                        </a>
                        <p className="mt-1 text-xs text-muted">
                          {lot.productCode ?? "-"} / JAN {lot.janCode ?? "-"} / {lot.category ?? "-"}
                        </p>
                      </td>
                      <td className="border-b border-line px-4 py-3 font-mono">{lot.lotNumber || "-"}</td>
                      <td className="border-b border-line px-4 py-3">
                        <span className="font-semibold">{formatExpiryDate(lot)}</span>
                        <p className="mt-1 text-xs text-muted">{formatDaysUntilExpiry(lot)}</p>
                      </td>
                      <td className="border-b border-line px-4 py-3">
                        <span className={`rounded px-2 py-1 text-xs font-semibold ${lot.statusBadgeClassName}`}>
                          {lot.statusLabel}
                        </span>
                      </td>
                      <td className="border-b border-line px-4 py-3 text-right text-lg font-semibold">{lot.quantity}</td>
                      <td className="border-b border-line px-4 py-3 text-muted">{dateTimeFormatter.format(lot.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-8 text-sm text-muted">
              条件に一致するロット別在庫はありません。
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
