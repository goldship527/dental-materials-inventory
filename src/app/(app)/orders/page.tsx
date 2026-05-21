import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getOrderRequestRows } from "@/lib/db/orders";
import { orderPrintUnassignedSupplierId } from "@/lib/orders/print";
import { orderRequestStatusLabels, type OrderRequestStatusValue } from "@/lib/orders/status";
import { OrderRequestTableRow } from "./order-request-row";
import { OrdersPrintButton } from "./print-button";

const statusOrder: OrderRequestStatusValue[] = ["DRAFT", "CONFIRMED", "SKIPPED"];
const statusFilters = [
  {
    label: "すべて",
    value: "",
  },
  ...statusOrder.map((status) => ({
    label: orderRequestStatusLabels[status],
    value: status,
  })),
];

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
  }>;
};

function buildOrdersHref(status: OrderRequestStatusValue | "", query: string) {
  const params = new URLSearchParams();

  if (query) {
    params.set("q", query);
  }

  if (status) {
    params.set("status", status);
  }

  const queryString = params.toString();

  return queryString ? `/orders?${queryString}` : "/orders";
}

function buildOrdersPrintHref(supplierId: string | null | undefined) {
  const selectedSupplierId = supplierId ?? orderPrintUnassignedSupplierId;

  return `/orders/print?supplierId=${encodeURIComponent(selectedSupplierId)}`;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const normalizedQuery = query.toLowerCase();
  const selectedStatus = statusOrder.includes(params.status as OrderRequestStatusValue)
    ? (params.status as OrderRequestStatusValue)
    : "";
  const selectedStatusLabel = selectedStatus ? orderRequestStatusLabels[selectedStatus] : "";
  const rows = await getOrderRequestRows(context.clinicId);
  const queryFilteredRows = rows.filter((row) => {
    const searchText = [row.name, row.productCode, row.category, row.supplierName, row.memo]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return normalizedQuery ? searchText.includes(normalizedQuery) : true;
  });
  const filteredRows = selectedStatus ? queryFilteredRows.filter((row) => row.status === selectedStatus) : queryFilteredRows;
  const counts = statusOrder.map((status) => ({
    status,
    label: orderRequestStatusLabels[status],
    count: queryFilteredRows.filter((row) => row.status === status).length,
  }));
  const countByStatus = Object.fromEntries(counts.map((item) => [item.status, item.count])) as Record<
    OrderRequestStatusValue,
    number
  >;
  const groupedRows = Array.from(
    filteredRows.reduce((groups, row) => {
      const supplierName = row.supplierName ?? "発注先未設定";
      const currentRows = groups.get(supplierName) ?? [];

      currentRows.push(row);
      groups.set(supplierName, currentRows);

      return groups;
    }, new Map<string, typeof queryFilteredRows>()),
  ).sort(([a], [b]) => a.localeCompare(b, "ja"));
  const generatedAt = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const hasFilter = Boolean(query || selectedStatus);
  const filterLabel = [
    query ? `検索: ${query}` : "",
    selectedStatusLabel ? `状態: ${selectedStatusLabel}` : "",
  ]
    .filter(Boolean)
    .join(" / ");
  const emptyMessage =
    rows.length === 0
      ? "まだ発注候補はありません。不足一覧から候補へ追加してください。"
      : "条件に一致する発注候補はありません。検索語や状態フィルタを見直してください。";

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink print:bg-white print:p-0 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 print:max-w-none print:gap-3">
        <AppNav current="orders" />

        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between print:border-black print:pb-3">
          <div>
            <p className="text-sm font-semibold text-accent print:text-black">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold print:text-2xl">発注候補</h1>
            <p className="mt-2 text-sm text-muted print:text-xs print:text-black">
              <span className="hidden print:inline">この一覧は発注前の確認用で、外部発注送信済みではありません。</span>
              発行日時: {generatedAt}
            </p>
          </div>
          <div className="flex gap-3 print:hidden">
            <a className="rounded border border-line px-5 py-3 text-sm font-semibold hover:border-accent" href="/shortage">
              不足一覧へ
            </a>
            <a
              className="rounded border border-line px-5 py-3 text-sm font-semibold hover:border-accent"
              href="/orders/print"
            >
              発注書下書き
            </a>
            <OrdersPrintButton />
          </div>
        </header>


        <section className="hidden grid-cols-4 gap-2 text-xs print:grid">
          <div className="border border-black px-2 py-1.5">印刷対象: {filteredRows.length} 件</div>
          <div className="border border-black px-2 py-1.5">検索後: {queryFilteredRows.length} 件</div>
          <div className="border border-black px-2 py-1.5">未確認: {countByStatus.DRAFT} 件</div>
          <div className="border border-black px-2 py-1.5">確認済み: {countByStatus.CONFIRMED} 件</div>
        </section>
        <section className="hidden border border-black px-2 py-1.5 text-xs print:block">
          出力条件: {filterLabel || "すべて"} / 全発注候補: {rows.length} 件 / 見送り: {countByStatus.SKIPPED} 件
        </section>

        <section className="grid gap-4 md:grid-cols-3 print:hidden">
          {counts.map((item) => (
            <div key={item.status} className="rounded border border-line bg-white p-5 shadow-panel">
              <p className="text-sm font-semibold text-muted">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold">{item.count} 件</p>
            </div>
          ))}
        </section>

        <form className="grid gap-3 rounded border border-line bg-white p-4 shadow-panel md:grid-cols-[1fr_auto_auto] print:hidden">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="商品名・商品コード・カテゴリ・発注先・メモ"
            className="h-11 rounded border border-line px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          {selectedStatus ? <input type="hidden" name="status" value={selectedStatus} /> : null}
          <button
            type="submit"
            className="h-11 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            検索
          </button>
          <a
            className="flex h-11 items-center justify-center rounded border border-line px-5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            href={selectedStatus ? buildOrdersHref(selectedStatus, "") : "/orders"}
          >
            クリア
          </a>
        </form>

        <section className="flex flex-wrap gap-2 print:hidden">
          {statusFilters.map((filter) => {
            const isCurrent = filter.value === selectedStatus;

            return (
              <a
                key={filter.value || "all"}
                href={buildOrdersHref(filter.value as OrderRequestStatusValue | "", query)}
                aria-current={isCurrent ? "page" : undefined}
                className={
                  isCurrent
                    ? "rounded bg-accent px-4 py-2 text-sm font-semibold text-white"
                    : "rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                }
              >
                {filter.label}
              </a>
            );
          })}
        </section>

        <section className="hidden grid-cols-3 gap-3 text-xs print:grid">
          <div className="min-h-12 border border-black px-3 py-2">確認者</div>
          <div className="min-h-12 border border-black px-3 py-2">発注前確認</div>
          <div className="min-h-12 border border-black px-3 py-2">印刷備考</div>
        </section>

        <section className="flex flex-col gap-4 print:gap-3">
          <div className="rounded border border-line bg-white px-4 py-3 text-sm text-muted shadow-panel print:rounded-none print:border-black print:px-2 print:py-2 print:text-xs print:text-black print:shadow-none">
            表示 {filteredRows.length} 件 / 検索後 {queryFilteredRows.length} 件 / 全 {rows.length} 件
            {hasFilter ? `（${filterLabel}）` : ""}
            <span className="hidden print:float-right print:inline">一般歯科材料在庫管理システム</span>
          </div>
          {groupedRows.length > 0 ? (
            groupedRows.map(([supplierName, supplierRows]) => (
              <section
                key={supplierName}
                className="overflow-hidden rounded border border-line bg-white shadow-panel print:break-inside-avoid print:rounded-none print:border-black print:shadow-none"
              >
                <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm print:border-black print:px-2 print:py-2 print:text-xs">
                  <h2 className="font-semibold">{supplierName}</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-muted print:text-black">{supplierRows.length} 件</span>
                    <a
                      className="rounded border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent print:hidden"
                      href={buildOrdersPrintHref(supplierRows[0]?.supplierId)}
                    >
                      この発注先の下書き
                    </a>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1180px] border-collapse text-left text-sm print:min-w-0 print:text-[10.5px]">
                    <thead className="bg-gray-50 text-xs text-muted print:bg-white print:text-[10px] print:text-black">
                      <tr>
                        <th className="border-b border-line px-4 py-3 print:border print:border-black print:px-2 print:py-1.5">
                          商品
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
                          発注数量
                        </th>
                        <th className="border-b border-line px-4 py-3 print:hidden">数量変更</th>
                        <th className="border-b border-line px-4 py-3 print:hidden">状態・メモ</th>
                        <th className="hidden border border-black px-2 py-1.5 print:table-cell">状態</th>
                        <th className="hidden border border-black px-2 py-1.5 print:table-cell">備考</th>
                        <th className="hidden border border-black px-2 py-1.5 print:table-cell">確認</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierRows.map((row) => (
                        <OrderRequestTableRow
                          key={`${row.id}-${row.status}-${row.requestedQuantity}-${row.memo ?? ""}`}
                          row={row}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          ) : (
            <div className="rounded border border-line bg-white px-4 py-12 text-center text-sm text-muted shadow-panel print:border-black print:shadow-none">
              {emptyMessage}
            </div>
          )}
        </section>

        <p className="hidden text-[10px] leading-5 text-black print:block">
          発注数量、発注先、状態、備考を確認してください。
        </p>
      </div>
    </main>
  );
}
