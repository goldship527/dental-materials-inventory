import { notFound } from "next/navigation";
import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminOverviewClinicDetail } from "@/lib/db/admin-overview";
import type { StockLotRow } from "@/lib/db/stock-lots";

type PageProps = {
  params: Promise<{
    clinicId: string;
  }>;
  searchParams?: Promise<{
    q?: string;
    category?: string;
    shortage?: string;
  }>;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function numberText(value: number, unit = "件") {
  return `${value.toLocaleString("ja-JP")} ${unit}`;
}

function formatDateTime(value: Date | null) {
  return value ? dateTimeFormatter.format(value) : "-";
}

function formatExpiryDate(row: StockLotRow) {
  if (row.expiryDate) {
    return dateFormatter.format(row.expiryDate);
  }

  return row.expiryDateText || "-";
}

function formatDaysUntilExpiry(row: StockLotRow) {
  if (row.daysUntilExpiry === null) {
    return "-";
  }

  if (row.daysUntilExpiry < 0) {
    return `${Math.abs(row.daysUntilExpiry)}日超過`;
  }

  if (row.daysUntilExpiry === 0) {
    return "本日";
  }

  return `残り${row.daysUntilExpiry}日`;
}

function buildDetailHref(clinicId: string, options: { q?: string; category?: string; shortage?: boolean }) {
  const params = new URLSearchParams();

  if (options.q) {
    params.set("q", options.q);
  }

  if (options.category) {
    params.set("category", options.category);
  }

  if (options.shortage) {
    params.set("shortage", "1");
  }

  const query = params.toString();

  return query ? `/admin/overview/${clinicId}?${query}` : `/admin/overview/${clinicId}`;
}

export default async function AdminOverviewClinicDetailPage({ params, searchParams }: PageProps) {
  const context = await requireAdminUser();
  const { clinicId } = await params;
  const selectedParams = (await searchParams) ?? {};
  const query = selectedParams.q?.trim() ?? "";
  const category = selectedParams.category ?? "";
  const shortageOnly = selectedParams.shortage === "1";
  const detail = await getAdminOverviewClinicDetail(context.organizationId, clinicId);

  if (!detail) {
    notFound();
  }

  const filteredRows = detail.stockRows.filter((row) => {
    const searchText = [row.name, row.productCode, row.janCode, row.category, row.manufacturer, row.supplierName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = query ? searchText.includes(query.toLowerCase()) : true;
    const matchesCategory = category ? row.category === category : true;
    const matchesShortage = shortageOnly ? row.isShortage : true;

    return matchesQuery && matchesCategory && matchesShortage;
  });
  const summaryItems = [
    {
      label: "在庫行",
      value: numberText(detail.summary.stockItemCount),
      note: `総在庫 ${detail.summary.totalQuantity.toLocaleString("ja-JP")}`,
    },
    {
      label: "不足在庫",
      value: numberText(detail.summary.shortageCount),
      note: `在庫0 ${numberText(detail.summary.zeroStockCount)}`,
      isWarning: detail.summary.shortageCount > 0,
    },
    {
      label: "発注候補",
      value: numberText(detail.orderStatusCounts.DRAFT),
      note: `発注予定 ${numberText(detail.orderStatusCounts.CONFIRMED)} / 発注済み ${numberText(detail.orderStatusCounts.ORDERED)}`,
      isWarning: detail.orderStatusCounts.DRAFT > 0,
    },
    {
      label: "期限ロット",
      value: numberText(detail.summary.attentionStockLotCount),
      note: "期限切れまたは30日以内",
      isWarning: detail.summary.attentionStockLotCount > 0,
    },
  ];

  return (
    <>
      <AppNav current="overview" />
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">本部ダッシュボード / クリニック詳細</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">{detail.clinic.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              この画面は読み取り専用です。クリニック別の在庫、不足、発注候補、期限ロットを確認できます。
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {detail.clinic.address ? <span>住所: {detail.clinic.address}</span> : null}
              {detail.clinic.phone ? <span>電話: {detail.clinic.phone}</span> : null}
              <span>最終入出庫: {formatDateTime(detail.summary.latestMovementAt)}</span>
            </div>
          </div>
          <a
            className="inline-flex h-11 shrink-0 items-center justify-center rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            href="/admin/overview"
          >
            本部ダッシュボードへ戻る
          </a>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaryItems.map((item) => (
            <div key={item.label} className="rounded border border-line bg-white p-5 shadow-panel">
              <p className="text-sm font-semibold text-muted">{item.label}</p>
              <p
                className={
                  item.isWarning
                    ? "mt-2 text-3xl font-semibold text-warning"
                    : "mt-2 text-3xl font-semibold text-ink"
                }
              >
                {item.value}
              </p>
              <p className="mt-2 text-sm text-muted">{item.note}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <a
            className="rounded border border-line bg-white p-4 shadow-panel transition hover:border-accent"
            href={`/admin/overview/${clinicId}/shortage`}
          >
            <p className="text-sm font-semibold text-accent">不足在庫を見る</p>
            <p className="mt-2 text-sm leading-6 text-muted">不足商品だけを、発注先や不足数と一緒に確認します。</p>
          </a>
          <a
            className="rounded border border-line bg-white p-4 shadow-panel transition hover:border-accent"
            href={`/admin/overview/${clinicId}/orders`}
          >
            <p className="text-sm font-semibold text-accent">発注候補を見る</p>
            <p className="mt-2 text-sm leading-6 text-muted">確認待ち、発注予定、発注済みの候補を読み取り専用で確認します。</p>
          </a>
          <a
            className="rounded border border-line bg-white p-4 shadow-panel transition hover:border-accent"
            href={`/admin/overview/${clinicId}/movements`}
          >
            <p className="text-sm font-semibold text-accent">入出庫履歴を見る</p>
            <p className="mt-2 text-sm leading-6 text-muted">最近の入庫、出庫、調整履歴を最新100件まで確認します。</p>
          </a>
        </section>

        <section className="rounded border border-line bg-white p-4 shadow-panel">
          <form className="grid gap-3 lg:grid-cols-[1fr_220px_auto_auto]" action={`/admin/overview/${clinicId}`}>
            <label className="grid gap-2 text-sm font-semibold text-muted">
              検索
              <input
                className="h-11 rounded border border-line bg-white px-3 text-base font-normal text-ink outline-none transition placeholder:text-muted focus:border-accent"
                defaultValue={query}
                name="q"
                placeholder="商品名、商品コード、JAN、発注先"
                type="search"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-muted">
              カテゴリ
              <select
                className="h-11 rounded border border-line bg-white px-3 text-base font-normal text-ink outline-none transition focus:border-accent"
                defaultValue={category}
                name="category"
              >
                <option value="">すべて</option>
                {detail.categories.map((categoryName) => (
                  <option key={categoryName} value={categoryName}>
                    {categoryName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-2 self-end rounded border border-line px-3 text-sm font-semibold text-muted">
              <input defaultChecked={shortageOnly} name="shortage" type="checkbox" value="1" />
              不足のみ
            </label>
            <button
              className="h-11 self-end rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
              type="submit"
            >
              表示
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <a
              className="inline-flex h-9 items-center rounded border border-line px-3 font-semibold text-muted transition hover:border-accent hover:text-accent"
              href={buildDetailHref(clinicId, { q: query, category, shortage: true })}
            >
              不足だけ見る
            </a>
            <a
              className="inline-flex h-9 items-center rounded border border-line px-3 font-semibold text-muted transition hover:border-accent hover:text-accent"
              href={buildDetailHref(clinicId, {})}
            >
              条件をクリア
            </a>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="border-b border-line px-5 py-4 text-sm text-muted">
            表示 {filteredRows.length} 件 / 全 {detail.stockRows.length} 件
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">商品</th>
                  <th className="border-b border-line px-4 py-3">カテゴリ</th>
                  <th className="border-b border-line px-4 py-3">発注先</th>
                  <th className="border-b border-line px-4 py-3 text-right">現在庫</th>
                  <th className="border-b border-line px-4 py-3 text-right">最低在庫</th>
                  <th className="border-b border-line px-4 py-3 text-right">不足数</th>
                  <th className="border-b border-line px-4 py-3">ステータス</th>
                  <th className="border-b border-line px-4 py-3">保管場所</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.stockItemId} className="align-top">
                    <td className="border-b border-line px-4 py-3">
                      <p className="font-semibold text-ink">{row.name}</p>
                      <p className="mt-1 text-xs text-muted">
                        {row.productCode ?? "-"} / JAN {row.janCode ?? "-"}
                      </p>
                    </td>
                    <td className="border-b border-line px-4 py-3">{row.category ?? "-"}</td>
                    <td className="border-b border-line px-4 py-3">{row.supplierName ?? "-"}</td>
                    <td className="border-b border-line px-4 py-3 text-right text-lg font-semibold">
                      {row.quantity.toLocaleString("ja-JP")}
                    </td>
                    <td className="border-b border-line px-4 py-3 text-right">{row.minStock}</td>
                    <td
                      className={
                        row.shortageCount > 0
                          ? "border-b border-line px-4 py-3 text-right font-semibold text-warning"
                          : "border-b border-line px-4 py-3 text-right"
                      }
                    >
                      {row.shortageCount}
                    </td>
                    <td className="border-b border-line px-4 py-3">
                      <span className={`rounded px-2 py-1 text-xs font-semibold ${row.stockStatusClassName}`}>
                        {row.stockStatusLabel}
                      </span>
                    </td>
                    <td className="border-b border-line px-4 py-3">{row.location ?? "-"}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-muted">
                      条件に合う在庫行がありません。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-lg font-semibold text-ink">期限ロット要確認</h2>
            <p className="mt-1 text-sm text-muted">期限切れ、または30日以内に期限を迎えるロットです。</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">商品</th>
                  <th className="border-b border-line px-4 py-3">ロット番号</th>
                  <th className="border-b border-line px-4 py-3">有効期限</th>
                  <th className="border-b border-line px-4 py-3">残日数</th>
                  <th className="border-b border-line px-4 py-3 text-right">数量</th>
                  <th className="border-b border-line px-4 py-3">状態</th>
                </tr>
              </thead>
              <tbody>
                {detail.attentionStockLotRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="border-b border-line px-4 py-3">
                      <p className="font-semibold text-ink">{row.productName}</p>
                      <p className="mt-1 text-xs text-muted">{row.productCode ?? "-"}</p>
                    </td>
                    <td className="border-b border-line px-4 py-3">{row.lotNumber || "-"}</td>
                    <td className="border-b border-line px-4 py-3">{formatExpiryDate(row)}</td>
                    <td className="border-b border-line px-4 py-3">{formatDaysUntilExpiry(row)}</td>
                    <td className="border-b border-line px-4 py-3 text-right">{row.quantity}</td>
                    <td className="border-b border-line px-4 py-3">
                      <span className={`rounded px-2 py-1 text-xs font-semibold ${row.statusBadgeClassName}`}>
                        {row.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
                {detail.attentionStockLotRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted">
                      要確認の期限ロットはありません。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
