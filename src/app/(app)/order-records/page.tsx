import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getOrderRecordListRows } from "@/lib/db/order-records";
import { orderSendMethodLabels } from "@/lib/orders/send-method";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatOrderRecordId(orderRecordId: string) {
  return orderRecordId.slice(-8);
}

function getReceiptSummary(receivedRequestCount: number, requestCount: number) {
  if (requestCount === 0) {
    return "候補なし";
  }

  if (receivedRequestCount === 0) {
    return "未納品";
  }

  if (receivedRequestCount === requestCount) {
    return "納品確認済み";
  }

  return `一部納品 ${receivedRequestCount}/${requestCount}`;
}

export default async function OrderRecordsPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const normalizedQuery = query.toLowerCase();
  const rows = await getOrderRecordListRows(context.clinicId);
  const filteredRows = rows.filter((row) => {
    const searchText = [
      formatOrderRecordId(row.id),
      row.supplierName,
      orderSendMethodLabels[row.orderedMethod],
      row.orderedMemo,
      row.supplierResponseMemo,
      row.createdByUserName,
      ...row.requests.flatMap((request) => [request.productName, request.productCode]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return normalizedQuery ? searchText.includes(normalizedQuery) : true;
  });
  const totalRequests = filteredRows.reduce((sum, row) => sum + row.requestCount, 0);
  const totalReceivedRequests = filteredRows.reduce((sum, row) => sum + row.receivedRequestCount, 0);
  const emptyMessage =
    rows.length === 0
      ? "発注記録はまだありません。発注候補の発注を記録すると、ここに記録されます。"
      : "条件に一致する発注記録はありません。検索語を見直してください。";

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppNav current="orders" />

        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">発注記録</h1>
            <p className="mt-2 text-sm text-muted">
              発注を記録したまとまりを、発注先・送付方法・納品状況とあわせて確認します。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              className="inline-flex h-11 shrink-0 items-center justify-center rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              href="/orders"
            >
              発注候補へ
            </a>
            <a
              className="inline-flex h-11 shrink-0 items-center justify-center rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              href="/home"
            >
              ホームへ戻る
            </a>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded border border-line/90 bg-panel/95 p-4 shadow-panel">
            <p className="text-sm font-semibold text-muted">発注記録</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{filteredRows.length} 件</p>
          </div>
          <div className="rounded border border-line/90 bg-panel/95 p-4 shadow-panel">
            <p className="text-sm font-semibold text-muted">発注候補</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{totalRequests} 件</p>
          </div>
          <div className="rounded border border-line/90 bg-panel/95 p-4 shadow-panel">
            <p className="text-sm font-semibold text-muted">納品確認済み</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{totalReceivedRequests} 件</p>
          </div>
          <div className="rounded border border-line/90 bg-panel/95 p-4 shadow-panel">
            <p className="text-sm font-semibold text-muted">未納品</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{Math.max(0, totalRequests - totalReceivedRequests)} 件</p>
          </div>
        </section>

        <form className="grid gap-3 rounded border border-line/90 bg-panel/95 p-3 shadow-panel md:grid-cols-[1fr_auto_auto]">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="発注先・商品名・発注記録ID・メモ"
            className="h-10 rounded border border-line bg-white/90 px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="submit"
            className="h-10 rounded bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accentDeep"
          >
            検索
          </button>
          <a
            className="flex h-10 items-center justify-center rounded border border-line bg-white/75 px-4 text-sm font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent"
            href="/order-records"
          >
            クリア
          </a>
        </form>

        <section className="rounded border border-line bg-white px-4 py-3 text-sm text-muted shadow-panel">
          表示 {filteredRows.length} 件 / 全 {rows.length} 件
          {query ? `（検索: ${query}）` : ""}
        </section>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">発注日時</th>
                  <th className="border-b border-line px-4 py-3">発注記録</th>
                  <th className="border-b border-line px-4 py-3">発注先</th>
                  <th className="border-b border-line px-4 py-3">送付方法</th>
                  <th className="border-b border-line px-4 py-3 text-right">候補</th>
                  <th className="border-b border-line px-4 py-3 text-right">発注数量</th>
                  <th className="border-b border-line px-4 py-3">納品状況</th>
                  <th className="border-b border-line px-4 py-3">商品</th>
                  <th className="border-b border-line px-4 py-3">メモ</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="border-b border-line px-4 py-3 text-muted">
                        {dateTimeFormatter.format(row.orderedAt)}
                      </td>
                      <td className="border-b border-line px-4 py-3">
                        <span className="font-semibold text-ink">{formatOrderRecordId(row.id)}</span>
                        <p className="mt-1 text-xs text-muted">作成者: {row.createdByUserName}</p>
                      </td>
                      <td className="border-b border-line px-4 py-3">
                        {row.supplierId ? (
                          <a className="font-semibold text-accent hover:underline" href={`/suppliers/${row.supplierId}`}>
                            {row.supplierName ?? "発注先名未設定"}
                          </a>
                        ) : (
                          <span className="text-muted">発注先未設定</span>
                        )}
                      </td>
                      <td className="border-b border-line px-4 py-3">{orderSendMethodLabels[row.orderedMethod]}</td>
                      <td className="border-b border-line px-4 py-3 text-right">{row.requestCount}</td>
                      <td className="border-b border-line px-4 py-3 text-right">{row.totalRequestedQuantity}</td>
                      <td className="border-b border-line px-4 py-3">
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-muted">
                          {getReceiptSummary(row.receivedRequestCount, row.requestCount)}
                        </span>
                        <p className="mt-1 text-xs text-muted">納品数量 {row.totalReceivedQuantity}</p>
                      </td>
                      <td className="border-b border-line px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {row.requests.slice(0, 3).map((request) => (
                            <a
                              key={request.id}
                              className="font-semibold text-accent hover:underline"
                              href={`/products/${request.productId}`}
                            >
                              {request.productName}
                              <span className="font-normal text-muted">
                                {request.productCode ? ` / ${request.productCode}` : ""}
                              </span>
                            </a>
                          ))}
                          {row.requests.length > 3 ? (
                            <p className="text-xs text-muted">ほか {row.requests.length - 3} 件</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="border-b border-line px-4 py-3 text-muted">
                        {row.orderedMemo ? <p>送付: {row.orderedMemo}</p> : null}
                        {row.supplierResponseMemo ? <p className="mt-1">先方: {row.supplierResponseMemo}</p> : null}
                        {!row.orderedMemo && !row.supplierResponseMemo ? "-" : null}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted" colSpan={9}>
                      {emptyMessage}
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
