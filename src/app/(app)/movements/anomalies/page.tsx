import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { isAdminRole } from "@/lib/auth/roles";
import { getOrganizationSettings } from "@/lib/db/organization-settings";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getStockAnomalies } from "@/lib/db/stock-anomalies";

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatNumber(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 1,
  }).format(value);
}

function buildMovementHref(productName: string) {
  const params = new URLSearchParams({
    type: "OUT",
    q: productName,
  });

  return `/movements?${params.toString()}`;
}

export default async function StockAnomaliesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const canManageSettings = isAdminRole(session.user.role);
  const settings = await getOrganizationSettings(context.organizationId);
  const anomalies = await getStockAnomalies(context.organizationId, context.clinicId, {
    threshold: settings.anomalyOutThreshold,
  });
  const totalTodayQuantity = anomalies.reduce((total, row) => total + row.todayQuantity, 0);

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppNav current="movements" />

        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">異常出庫検知</h1>
            <p className="mt-2 text-sm text-muted">
              直近24時間の出庫数が、過去30日の通常ペースより多い商品を表示します。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            {canManageSettings ? (
              <a
                className="inline-flex h-11 items-center rounded border border-line px-4 text-muted transition hover:border-accent hover:text-accent"
                href="/admin/settings"
              >
                閾値設定
              </a>
            ) : null}
            <a
              className="inline-flex h-11 items-center rounded border border-line px-4 text-muted transition hover:border-accent hover:text-accent"
              href="/movements"
            >
              入出庫履歴へ
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
            <p className="text-sm font-semibold text-muted">検知件数</p>
            <p className={anomalies.length > 0 ? "mt-2 text-3xl font-semibold text-warning" : "mt-2 text-3xl font-semibold"}>
              {anomalies.length}
            </p>
            <p className="mt-2 text-sm text-muted">表示のみ。出庫の取消や在庫数の変更は行いません。</p>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">直近24時間の出庫数</p>
            <p className="mt-2 text-3xl font-semibold">{formatNumber(totalTodayQuantity)}</p>
            <p className="mt-2 text-sm text-muted">検知された商品の合計です。</p>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <p className="text-sm font-semibold text-muted">現在の閾値</p>
            <p className="mt-2 text-3xl font-semibold">{formatNumber(settings.anomalyOutThreshold)}倍</p>
            <p className="mt-2 text-sm text-muted">過去30日の平均に対する倍率です。</p>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="border-b border-line px-4 py-3 text-sm text-muted">
            直近24時間 / 基準: 過去30日の日次平均 / baselineDaily 0.1未満は対象外
          </div>
          {anomalies.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                <thead className="bg-gray-50 text-xs text-muted">
                  <tr>
                    <th className="border-b border-line px-4 py-3">商品</th>
                    <th className="border-b border-line px-4 py-3">カテゴリ</th>
                    <th className="border-b border-line px-4 py-3 text-right">直近24時間</th>
                    <th className="border-b border-line px-4 py-3 text-right">通常平均/日</th>
                    <th className="border-b border-line px-4 py-3 text-right">倍率</th>
                    <th className="border-b border-line px-4 py-3">操作者</th>
                    <th className="border-b border-line px-4 py-3">最終出庫</th>
                    <th className="border-b border-line px-4 py-3">確認</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((row) => (
                    <tr key={row.productId} className="align-top">
                      <td className="border-b border-line px-4 py-3">
                        <a className="font-semibold text-accent hover:underline" href={`/products/${row.productId}`}>
                          {row.productName}
                        </a>
                        <p className="mt-1 text-xs text-muted">{row.productCode ?? "商品コード未設定"}</p>
                      </td>
                      <td className="border-b border-line px-4 py-3">{row.category ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3 text-right text-lg font-semibold text-warning">
                        {formatNumber(row.todayQuantity)}
                      </td>
                      <td className="border-b border-line px-4 py-3 text-right">{formatNumber(row.baselineDaily)}</td>
                      <td className="border-b border-line px-4 py-3 text-right font-semibold">
                        {formatNumber(row.ratio)}倍
                      </td>
                      <td className="border-b border-line px-4 py-3">
                        {row.operatorNames.length > 0 ? row.operatorNames.join("、") : "-"}
                      </td>
                      <td className="border-b border-line px-4 py-3">
                        {row.latestMovementAt ? dateTimeFormatter.format(row.latestMovementAt) : "-"}
                      </td>
                      <td className="border-b border-line px-4 py-3">
                        <a className="font-semibold text-accent hover:underline" href={buildMovementHref(row.productName)}>
                          履歴を見る
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-8 text-sm text-muted">現在、異常出庫として検知された商品はありません。</p>
          )}
        </section>
      </div>
    </main>
  );
}
