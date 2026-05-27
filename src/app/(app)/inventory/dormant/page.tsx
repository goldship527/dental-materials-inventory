import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { getDormantStockRows, normalizeDormantDays } from "@/lib/db/dormant-stock";
import { requireActiveClinic } from "@/lib/db/clinic";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    days?: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const dayOptions = [90, 180, 365] as const;

function formatLastOutAt(value: Date | null) {
  return value ? dateFormatter.format(value) : "出庫履歴なし";
}

function formatStagnantDays(value: number | null) {
  return value === null ? "未算出" : `${value}日`;
}

function formatAmount(value: number | null) {
  return value === null ? "-" : yenFormatter.format(value);
}

function buildDaysHref(days: number, query: string) {
  const params = new URLSearchParams();

  params.set("days", String(days));
  if (query) {
    params.set("q", query);
  }

  return `/inventory/dormant?${params.toString()}`;
}

export default async function DormantStockPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const selectedDays = normalizeDormantDays(params.days);
  const rows = await getDormantStockRows(context.organizationId, context.clinicId, selectedDays);
  const normalizedQuery = query.toLowerCase();
  const filteredRows = rows.filter((row) => {
    const searchText = [
      row.productName,
      row.productCode,
      row.janCode,
      row.category,
      row.manufacturer,
      row.location,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return normalizedQuery ? searchText.includes(normalizedQuery) : true;
  });
  const totalQuantity = filteredRows.reduce((total, row) => total + row.currentQuantity, 0);
  const totalAmount = filteredRows.reduce((total, row) => total + (row.stagnantAmount ?? 0), 0);

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppNav current="dormant" />

        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">死蔵在庫レポート</h1>
            <p className="mt-2 text-sm text-muted">
              過去{selectedDays}日以内に出庫がなく、現在庫が1以上ある商品を表示します。
            </p>
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

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">対象商品</p>
            <p className={filteredRows.length > 0 ? "mt-2 text-3xl font-semibold text-warning" : "mt-2 text-3xl font-semibold"}>
              {filteredRows.length}
            </p>
            <p className="mt-2 text-sm text-muted">表示中の死蔵在庫候補</p>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">対象数量</p>
            <p className="mt-2 text-3xl font-semibold">{totalQuantity}</p>
            <p className="mt-2 text-sm text-muted">現在庫の合計</p>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">滞留金額</p>
            <p className="mt-2 text-3xl font-semibold">{formatAmount(totalAmount)}</p>
            <p className="mt-2 text-sm text-muted">標準価格がある商品の概算</p>
          </div>
        </section>

        <section className="rounded border border-line bg-white p-4 shadow-panel">
          <form className="grid gap-3 lg:grid-cols-[1fr_auto]" action="/inventory/dormant">
            <input type="hidden" name="days" value={selectedDays} />
            <label className="grid gap-2 text-sm font-semibold text-muted">
              検索
              <input
                className="h-11 rounded border border-line bg-white px-3 text-base font-normal text-ink outline-none transition placeholder:text-muted focus:border-accent"
                defaultValue={query}
                name="q"
                placeholder="商品名、商品コード、JAN、カテゴリ、保管場所"
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
            {dayOptions.map((days) => {
              const isCurrent = selectedDays === days;

              return (
                <a
                  key={days}
                  aria-current={isCurrent ? "page" : undefined}
                  className={
                    isCurrent
                      ? "inline-flex h-10 shrink-0 items-center rounded border border-accent/30 bg-teal-50 px-3 text-sm font-semibold text-accent"
                      : "inline-flex h-10 shrink-0 items-center rounded border border-line px-3 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                  }
                  href={buildDaysHref(days, query)}
                >
                  {days}日
                </a>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="border-b border-line px-4 py-3 text-sm text-muted">
            表示 {filteredRows.length} 件 / 対象 {rows.length} 件
            {query ? `（検索: ${query}）` : ""}
          </div>
          {filteredRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                <thead className="bg-gray-50 text-xs text-muted">
                  <tr>
                    <th className="border-b border-line px-4 py-3">商品</th>
                    <th className="border-b border-line px-4 py-3">カテゴリ</th>
                    <th className="border-b border-line px-4 py-3 text-right">現在庫</th>
                    <th className="border-b border-line px-4 py-3 text-right">最低在庫</th>
                    <th className="border-b border-line px-4 py-3">保管場所</th>
                    <th className="border-b border-line px-4 py-3">最終出庫日</th>
                    <th className="border-b border-line px-4 py-3 text-right">滞留日数</th>
                    <th className="border-b border-line px-4 py-3 text-right">滞留金額</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.stockItemId} className="align-top">
                      <td className="border-b border-line px-4 py-3">
                        <a className="font-semibold text-accent hover:underline" href={`/products/${row.productId}`}>
                          {row.productName}
                        </a>
                        <p className="mt-1 text-xs text-muted">
                          {row.productCode ?? "-"} / JAN {row.janCode ?? "-"}
                        </p>
                      </td>
                      <td className="border-b border-line px-4 py-3">{row.category ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3 text-right text-lg font-semibold">{row.currentQuantity}</td>
                      <td className="border-b border-line px-4 py-3 text-right">{row.minStock}</td>
                      <td className="border-b border-line px-4 py-3">{row.location ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3">{formatLastOutAt(row.lastOutAt)}</td>
                      <td className="border-b border-line px-4 py-3 text-right">{formatStagnantDays(row.stagnantDays)}</td>
                      <td className="border-b border-line px-4 py-3 text-right font-semibold">{formatAmount(row.stagnantAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-8 text-sm text-muted">
              条件に一致する死蔵在庫候補はありません。
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
