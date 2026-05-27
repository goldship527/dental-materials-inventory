import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminOverview } from "@/lib/db/admin-overview";

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(value: Date | null) {
  return value ? dateTimeFormatter.format(value) : "-";
}

function numberText(value: number, unit = "件") {
  return `${value.toLocaleString("ja-JP")} ${unit}`;
}

export default async function AdminOverviewPage() {
  const context = await requireAdminUser();
  const overview = await getAdminOverview(context.organizationId);
  const plannedOrderRequestCount =
    overview.summary.draftOrderRequestCount + overview.summary.confirmedOrderRequestCount;
  const summaryItems = [
    {
      label: "対象クリニック",
      value: numberText(overview.summary.clinicCount),
      note: "同一組織内の有効クリニック",
    },
    {
      label: "不足在庫",
      value: numberText(overview.summary.shortageCount),
      note: `在庫0 ${numberText(overview.summary.zeroStockCount)}`,
      isWarning: overview.summary.shortageCount > 0,
    },
    {
      label: "発注予定の候補",
      value: numberText(plannedOrderRequestCount),
      note: "これから発注する候補",
      isWarning: plannedOrderRequestCount > 0,
    },
    {
      label: "期限ロット要確認",
      value: numberText(overview.summary.attentionStockLotCount),
      note: "期限切れまたは30日以内",
      isWarning: overview.summary.attentionStockLotCount > 0,
    },
  ];

  return (
    <>
      <AppNav current="overview" />
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="grid gap-2">
          <p className="text-sm font-semibold text-accent">管理</p>
          <h1 className="text-2xl font-bold tracking-normal text-ink">本部ダッシュボード</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted">
            クリニック別の不足、発注候補、期限ロットを読み取り専用で確認します。
          </p>
        </header>

        <section className="flex flex-wrap gap-3">
          <a
            className="inline-flex h-11 items-center justify-center rounded border border-line bg-white px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            href="/admin/overview/usage-export"
          >
            使用個数CSV出力
          </a>
        </section>

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

        <section className="rounded border border-line bg-white shadow-panel">
          <div className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">クリニック別状況</h2>
              <p className="mt-1 text-sm text-muted">
                最終入出庫: {formatDateTime(overview.summary.latestMovementAt)}
              </p>
            </div>
            <span className="w-fit rounded bg-gray-50 px-3 py-1 text-xs font-semibold text-muted">読み取り専用</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-normal text-muted">
                <tr>
                  <th scope="col" className="min-w-56 px-5 py-3">
                    クリニック
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-right">
                    商品
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-right">
                    総在庫
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-right">
                    不足
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-right">
                    在庫0
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-right">
                    発注予定
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-right">
                    発注記録あり
                  </th>
                  <th scope="col" className="whitespace-nowrap px-4 py-3 text-right">
                    期限ロット
                  </th>
                  <th scope="col" className="whitespace-nowrap px-5 py-3">
                    最終入出庫
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {overview.rows.map((row) => {
                  const rowPlannedOrderRequestCount = row.draftOrderRequestCount + row.confirmedOrderRequestCount;

                  return (
                  <tr key={row.clinicId} className="align-top">
                    <th scope="row" className="px-5 py-4 text-left font-semibold text-ink">
                      <a className="block text-accent hover:underline" href={`/admin/overview/${row.clinicId}`}>
                        {row.clinicName}
                      </a>
                      {row.clinicAddress ? (
                        <span className="mt-1 block text-xs font-normal text-muted">{row.clinicAddress}</span>
                      ) : null}
                      <span className="mt-2 block text-xs font-semibold text-muted">詳細を見る</span>
                    </th>
                    <td className="whitespace-nowrap px-4 py-4 text-right">{numberText(row.stockItemCount)}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      {row.totalQuantity.toLocaleString("ja-JP")}
                    </td>
                    <td
                      className={
                        row.shortageCount > 0
                          ? "whitespace-nowrap px-4 py-4 text-right font-semibold text-warning"
                          : "whitespace-nowrap px-4 py-4 text-right"
                      }
                    >
                      {numberText(row.shortageCount)}
                    </td>
                    <td
                      className={
                        row.zeroStockCount > 0
                          ? "whitespace-nowrap px-4 py-4 text-right font-semibold text-warning"
                          : "whitespace-nowrap px-4 py-4 text-right"
                      }
                    >
                      {numberText(row.zeroStockCount)}
                    </td>
                    <td
                      className={
                        rowPlannedOrderRequestCount > 0
                          ? "whitespace-nowrap px-4 py-4 text-right font-semibold text-warning"
                          : "whitespace-nowrap px-4 py-4 text-right"
                      }
                    >
                      {numberText(rowPlannedOrderRequestCount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      {numberText(row.orderedRequestCount)}
                    </td>
                    <td
                      className={
                        row.attentionStockLotCount > 0
                          ? "whitespace-nowrap px-4 py-4 text-right font-semibold text-warning"
                          : "whitespace-nowrap px-4 py-4 text-right"
                      }
                    >
                      {numberText(row.attentionStockLotCount)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-muted">{formatDateTime(row.latestMovementAt)}</td>
                  </tr>
                  );
                })}
                {overview.rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-8 text-center text-muted">
                      表示できるクリニックがありません。
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
