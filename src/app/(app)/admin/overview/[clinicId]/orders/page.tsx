import { notFound } from "next/navigation";
import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminOverviewClinicDetail } from "@/lib/db/admin-overview";
import { getOrderRequestRows } from "@/lib/db/orders";
import { orderRequestStatusLabels, orderRequestStatuses, type OrderRequestStatusValue } from "@/lib/orders/status";

type PageProps = {
  params: Promise<{
    clinicId: string;
  }>;
  searchParams?: Promise<{
    q?: string;
    status?: string;
  }>;
};

function numberText(value: number, unit = "件") {
  return `${value.toLocaleString("ja-JP")} ${unit}`;
}

function buildOrdersHref(clinicId: string, status: OrderRequestStatusValue | "", query: string) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (status) {
    params.set("status", status);
  }

  const queryString = params.toString();

  return queryString ? `/admin/overview/${clinicId}/orders?${queryString}` : `/admin/overview/${clinicId}/orders`;
}

export default async function AdminOverviewClinicOrdersPage({ params, searchParams }: PageProps) {
  const context = await requireAdminUser();
  const { clinicId } = await params;
  const selectedParams = (await searchParams) ?? {};
  const query = selectedParams.q?.trim() ?? "";
  const normalizedQuery = query.toLowerCase();
  const selectedStatus = orderRequestStatuses.includes(selectedParams.status as OrderRequestStatusValue)
    ? (selectedParams.status as OrderRequestStatusValue)
    : "";
  const detail = await getAdminOverviewClinicDetail(context.organizationId, clinicId);

  if (!detail) {
    notFound();
  }

  const rows = await getOrderRequestRows(clinicId);
  const queryFilteredRows = rows.filter((row) => {
    const searchText = [row.name, row.productCode, row.category, row.supplierName, row.memo]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return normalizedQuery ? searchText.includes(normalizedQuery) : true;
  });
  const filteredRows = selectedStatus
    ? queryFilteredRows.filter((row) => row.status === selectedStatus)
    : queryFilteredRows;
  const counts = orderRequestStatuses.map((status) => ({
    status,
    label: orderRequestStatusLabels[status],
    count: queryFilteredRows.filter((row) => row.status === status).length,
  }));

  return (
    <>
      <AppNav current="overview" />
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">本部ダッシュボード / 発注候補</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">{detail.clinic.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              この画面は読み取り専用です。発注候補の状態、数量、発注先、メモを確認できます。
            </p>
          </div>
          <a
            className="inline-flex h-11 shrink-0 items-center justify-center rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            href={`/admin/overview/${clinicId}`}
          >
            クリニック詳細へ戻る
          </a>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          {counts.map((item) => (
            <a
              key={item.status}
              className="rounded border border-line bg-white p-4 shadow-panel transition hover:border-accent"
              href={buildOrdersHref(clinicId, item.status, query)}
            >
              <p className="text-sm font-semibold text-muted">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{numberText(item.count)}</p>
            </a>
          ))}
        </section>

        <section className="rounded border border-line bg-white p-4 shadow-panel">
          <form
            className="grid gap-3 md:grid-cols-[1fr_220px_auto_auto]"
            action={`/admin/overview/${clinicId}/orders`}
          >
            <input
              className="h-11 rounded border border-line bg-white px-3 text-base text-ink outline-none transition placeholder:text-muted focus:border-accent"
              defaultValue={query}
              name="q"
              placeholder="商品名、商品コード、カテゴリ、発注先、メモ"
              type="search"
            />
            <select
              className="h-11 rounded border border-line bg-white px-3 text-base text-ink outline-none transition focus:border-accent"
              defaultValue={selectedStatus}
              name="status"
            >
              <option value="">すべて</option>
              {orderRequestStatuses.map((status) => (
                <option key={status} value={status}>
                  {orderRequestStatusLabels[status]}
                </option>
              ))}
            </select>
            <button
              className="h-11 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
              type="submit"
            >
              表示
            </button>
            <a
              className="inline-flex h-11 items-center justify-center rounded border border-line px-5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              href={`/admin/overview/${clinicId}/orders`}
            >
              クリア
            </a>
          </form>
        </section>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="border-b border-line px-5 py-4 text-sm text-muted">
            表示 {filteredRows.length} 件 / 条件一致 {queryFilteredRows.length} 件 / 全 {rows.length} 件
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">商品</th>
                  <th className="border-b border-line px-4 py-3">発注先</th>
                  <th className="border-b border-line px-4 py-3 text-right">現在庫</th>
                  <th className="border-b border-line px-4 py-3 text-right">最低在庫</th>
                  <th className="border-b border-line px-4 py-3 text-right">不足数</th>
                  <th className="border-b border-line px-4 py-3 text-right">発注数量</th>
                  <th className="border-b border-line px-4 py-3">状態</th>
                  <th className="border-b border-line px-4 py-3">メモ</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="border-b border-line px-4 py-3">
                      <p className="font-semibold text-ink">{row.name}</p>
                      <p className="mt-1 text-xs text-muted">
                        {row.productCode ?? "-"} / {row.category ?? "-"}
                      </p>
                    </td>
                    <td className="border-b border-line px-4 py-3">{row.supplierName ?? "-"}</td>
                    <td className="border-b border-line px-4 py-3 text-right">{row.quantity}</td>
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
                    <td className="border-b border-line px-4 py-3 text-right font-semibold">
                      {row.requestedQuantity}
                    </td>
                    <td className="border-b border-line px-4 py-3">
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-muted">
                        {orderRequestStatusLabels[row.status]}
                      </span>
                    </td>
                    <td className="border-b border-line px-4 py-3 text-muted">{row.memo ?? "-"}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-muted">
                      条件に合う発注候補はありません。
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
