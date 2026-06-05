import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getOrderRequestRows, type OrderRequestRow } from "@/lib/db/orders";
import { getSupplierLeadTimes, type SupplierLeadTimeStats } from "@/lib/db/supplier-lead-times";
import { orderPrintUnassignedSupplierId } from "@/lib/orders/print";
import {
  printableOrderRequestStatuses,
  type OrderRequestStatusValue,
} from "@/lib/orders/status";
import { OrderRequestTableRow } from "./order-request-row";
import { OrdersPrintButton } from "./print-button";
import { SupplierOrderRecordPanel } from "./supplier-order-record-panel";

type OrderListFilterValue = "" | "PLANNED" | "AWAITING_RECEIPT" | "RECEIVED" | "SKIPPED";

const statusFilters: { label: string; value: OrderListFilterValue }[] = [
  {
    label: "すべて",
    value: "",
  },
  {
    label: "発注予定",
    value: "PLANNED",
  },
  {
    label: "納品待ち",
    value: "AWAITING_RECEIPT",
  },
  {
    label: "納品済み",
    value: "RECEIVED",
  },
  {
    label: "見送り",
    value: "SKIPPED",
  },
];
const orderRequestStatusRank = Object.fromEntries(["CONFIRMED", "DRAFT", "ORDERED", "SKIPPED"].map((status, index) => [status, index])) as Record<
  OrderRequestStatusValue,
  number
>;

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
  }>;
};

function buildOrdersHref(status: OrderListFilterValue, query: string) {
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

function getSupplierStatusChipClass(status: Exclude<OrderListFilterValue, "">) {
  if (status === "SKIPPED") {
    return "border-line bg-subtle text-muted";
  }

  if (status === "AWAITING_RECEIPT" || status === "RECEIVED") {
    return "border-green-100 bg-green-50 text-success";
  }

  if (status === "PLANNED") {
    return "border-teal-100 bg-teal-50 text-accent";
  }

  return "border-line bg-white/80 text-muted";
}

function formatSupplierLeadTime(leadTime: SupplierLeadTimeStats | undefined) {
  if (!leadTime) {
    return "平均納品日数: データ不足";
  }

  if (!leadTime.isSampleSufficient) {
    return `平均納品日数: データ不足（直近180日、${leadTime.sampleCount}件）`;
  }

  return `平均納品日数: ${leadTime.avgDays.toFixed(1)}日（中央値 ${leadTime.medianDays.toFixed(1)}日、直近180日、${leadTime.sampleCount}件）`;
}

function matchesOrderListFilter(row: OrderRequestRow, filter: OrderListFilterValue) {
  if (!filter) {
    return true;
  }

  if (filter === "PLANNED") {
    return printableOrderRequestStatuses.includes(row.status);
  }

  if (filter === "AWAITING_RECEIPT") {
    return row.status === "ORDERED" && !row.receivedAt;
  }

  if (filter === "RECEIVED") {
    return row.status === "ORDERED" && Boolean(row.receivedAt);
  }

  return row.status === "SKIPPED";
}

function sortRowsByStatusFlow(rows: OrderRequestRow[]) {
  return [...rows].sort((firstRow, secondRow) => orderRequestStatusRank[firstRow.status] - orderRequestStatusRank[secondRow.status]);
}

function OrderRequestRowsTable({ rows }: { rows: OrderRequestRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] border-collapse text-left text-sm print:min-w-0 print:text-[10.5px]">
        <thead className="bg-subtle text-xs text-muted print:bg-white print:text-[10px] print:text-black">
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
            <th className="border-b border-line px-4 py-3 print:hidden">数量・納品</th>
            <th className="border-b border-line px-4 py-3 print:hidden">状態</th>
            <th className="hidden border border-black px-2 py-1.5 print:table-cell">状態</th>
            <th className="hidden border border-black px-2 py-1.5 print:table-cell">備考</th>
            <th className="hidden border border-black px-2 py-1.5 print:table-cell">確認</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <OrderRequestTableRow
              key={`${row.id}-${row.status}-${row.requestedQuantity}-${row.memo ?? ""}-${row.orderedMethod ?? ""}-${row.orderedMemo ?? ""}-${row.supplierResponseMemo ?? ""}`}
              row={row}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
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
  const selectedStatus = statusFilters.some((filter) => filter.value === params.status)
    ? (params.status as OrderListFilterValue)
    : "";
  const selectedStatusLabel = statusFilters.find((filter) => filter.value === selectedStatus)?.label ?? "";
  const [rows, supplierLeadTimes] = await Promise.all([
    getOrderRequestRows(context.clinicId),
    getSupplierLeadTimes(context.organizationId),
  ]);
  const queryFilteredRows = rows.filter((row) => {
    const searchText = [row.name, row.productCode, row.category, row.supplierName, row.memo]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return normalizedQuery ? searchText.includes(normalizedQuery) : true;
  });
  const filteredRows = queryFilteredRows.filter((row) => matchesOrderListFilter(row, selectedStatus));
  const counts = [
    {
      status: "PLANNED" as const,
      label: "発注予定",
      count: queryFilteredRows.filter((row) => printableOrderRequestStatuses.includes(row.status)).length,
    },
    {
      status: "AWAITING_RECEIPT" as const,
      label: "納品待ち",
      count: queryFilteredRows.filter((row) => row.status === "ORDERED" && !row.receivedAt).length,
    },
    {
      status: "RECEIVED" as const,
      label: "納品済み",
      count: queryFilteredRows.filter((row) => row.status === "ORDERED" && row.receivedAt).length,
    },
    {
      status: "SKIPPED" as const,
      label: "見送り",
      count: queryFilteredRows.filter((row) => row.status === "SKIPPED").length,
    },
  ];
  const countByStatus = Object.fromEntries(counts.map((item) => [item.status, item.count])) as Record<
    Exclude<OrderListFilterValue, "">,
    number
  >;
  const groupedRows = Array.from(
    filteredRows.reduce((groups, row) => {
      const supplierKey = row.supplierId ?? orderPrintUnassignedSupplierId;
      const supplierName = row.supplierName ?? "発注先未設定";
      const currentGroup = groups.get(supplierKey) ?? {
        supplierName,
        rows: [] as typeof queryFilteredRows,
      };

      currentGroup.rows.push(row);
      groups.set(supplierKey, currentGroup);

      return groups;
    }, new Map<string, { supplierName: string; rows: typeof queryFilteredRows }>()),
  ).sort(([, a], [, b]) => a.supplierName.localeCompare(b.supplierName, "ja"));
  const generatedAt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
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
    <main className="min-h-screen bg-surface px-4 py-5 text-ink print:bg-white print:p-0 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 print:max-w-none print:gap-3">
        <AppNav current="orders" />

        <header className="flex flex-col gap-3 border-b border-line pb-4 md:flex-row md:items-end md:justify-between print:border-black print:pb-3">
          <div>
            <p className="text-sm font-semibold text-accent print:text-black">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold print:text-2xl">発注候補</h1>
            <p className="mt-2 text-sm text-muted print:text-xs print:text-black">
              <span className="hidden print:inline">この一覧は発注前の確認用で、外部発注送信済みではありません。</span>
              発行日時: {generatedAt}
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 print:hidden sm:flex sm:w-auto">
            <a className="inline-flex min-h-10 items-center justify-center rounded border border-line bg-white/75 px-4 py-2 text-sm font-semibold hover:border-accent hover:bg-white" href="/shortage">
              不足一覧へ
            </a>
            <a
              className="inline-flex min-h-10 items-center justify-center rounded border border-line bg-white/75 px-4 py-2 text-sm font-semibold hover:border-accent hover:bg-white"
              href="/orders/print"
            >
              発注書下書き
            </a>
            <a
              className="inline-flex min-h-10 items-center justify-center rounded border border-line bg-white/75 px-4 py-2 text-sm font-semibold hover:border-accent hover:bg-white"
              href="/order-records"
            >
              発注記録
            </a>
            <OrdersPrintButton />
          </div>
        </header>


        <section className="hidden grid-cols-4 gap-2 text-xs print:grid">
          <div className="border border-black px-2 py-1.5">印刷対象: {filteredRows.length} 件</div>
          <div className="border border-black px-2 py-1.5">検索後: {queryFilteredRows.length} 件</div>
          <div className="border border-black px-2 py-1.5">発注予定: {countByStatus.PLANNED} 件</div>
          <div className="border border-black px-2 py-1.5">納品待ち: {countByStatus.AWAITING_RECEIPT} 件</div>
        </section>
        <section className="hidden border border-black px-2 py-1.5 text-xs print:block">
          出力条件: {filterLabel || "すべて"} / 全発注候補: {rows.length} 件 / 納品済み: {countByStatus.RECEIVED} 件 / 見送り:{" "}
          {countByStatus.SKIPPED} 件
        </section>

        <section className="grid gap-3 md:grid-cols-4 print:hidden">
          {counts.map((item) => (
            <div key={item.status} className="rounded border border-line/90 bg-panel/95 p-4 shadow-panel">
              <p
                className={
                  item.status === "SKIPPED"
                    ? "text-sm font-semibold text-muted"
                    : item.status === "AWAITING_RECEIPT" || item.status === "RECEIVED"
                      ? "text-sm font-semibold text-success"
                      : "text-sm font-semibold text-muted"
                }
              >
                {item.label}
              </p>
              <p
                className={
                  item.status === "SKIPPED"
                    ? "mt-2 text-3xl font-bold tabular-nums text-muted"
                    : item.status === "AWAITING_RECEIPT" || item.status === "RECEIVED"
                      ? "mt-2 text-3xl font-bold tabular-nums text-success"
                      : "mt-2 text-3xl font-bold tabular-nums"
                }
              >
                {item.count} 件
              </p>
            </div>
          ))}
        </section>

        <form className="grid gap-3 rounded border border-line/90 bg-panel/95 p-3 shadow-panel md:grid-cols-[1fr_auto_auto] print:hidden">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="商品名・商品コード・カテゴリ・発注先・メモ"
            className="h-10 rounded border border-line bg-white/90 px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          {selectedStatus ? <input type="hidden" name="status" value={selectedStatus} /> : null}
          <button
            type="submit"
            className="h-10 rounded bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accentDeep"
          >
            検索
          </button>
          <a
            className="flex h-10 items-center justify-center rounded border border-line bg-white/75 px-4 text-sm font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent"
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
                href={buildOrdersHref(filter.value, query)}
                aria-current={isCurrent ? "page" : undefined}
                className={
                  filter.value === "SKIPPED"
                    ? isCurrent
                      ? "inline-flex min-h-10 items-center rounded border border-line bg-subtle px-3 py-2 text-sm font-semibold text-muted"
                      : "inline-flex min-h-10 items-center rounded border border-line bg-white/75 px-3 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:bg-subtle"
                    : filter.value === "AWAITING_RECEIPT" || filter.value === "RECEIVED"
                      ? isCurrent
                        ? "inline-flex min-h-10 items-center rounded border border-success bg-green-50 px-3 py-2 text-sm font-semibold text-success"
                        : "inline-flex min-h-10 items-center rounded border border-green-100 bg-white/75 px-3 py-2 text-sm font-semibold text-success transition hover:border-success hover:bg-green-50"
                    : isCurrent
                      ? "inline-flex min-h-10 items-center rounded border border-accent bg-accent px-3 py-2 text-sm font-semibold text-white"
                      : "inline-flex min-h-10 items-center rounded border border-line bg-white/75 px-3 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:bg-white hover:text-accent"
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

        <section className="flex flex-col gap-3 print:gap-3">
          <div className="rounded border border-line/90 bg-panel/95 px-4 py-2 text-sm text-muted shadow-panel print:rounded-none print:border-black print:px-2 print:py-2 print:text-xs print:text-black print:shadow-none">
            表示 {filteredRows.length} 件 / 検索後 {queryFilteredRows.length} 件 / 全 {rows.length} 件
            {hasFilter ? `（${filterLabel}）` : ""}
            <span className="hidden print:float-right print:inline">一般歯科材料在庫管理システム</span>
          </div>
          {groupedRows.length > 0 ? (
            groupedRows.map(([supplierKey, group]) => {
              const supplierName = group.supplierName;
              const supplierRows = group.rows;
              const supplierLeadTime =
                supplierKey === orderPrintUnassignedSupplierId ? undefined : supplierLeadTimes[supplierKey];
              const activeRows = sortRowsByStatusFlow(supplierRows.filter((row) => printableOrderRequestStatuses.includes(row.status)));
              const awaitingReceiptRows = sortRowsByStatusFlow(supplierRows.filter((row) => row.status === "ORDERED" && !row.receivedAt));
              const receivedRows = sortRowsByStatusFlow(supplierRows.filter((row) => row.status === "ORDERED" && row.receivedAt));
              const skippedRows = sortRowsByStatusFlow(supplierRows.filter((row) => row.status === "SKIPPED"));
              const rowBlocks = [
                {
                  key: "active",
                  title: "発注予定",
                  description: "これから発注する対象",
                  rows: activeRows,
                  className: "border-accent/30",
                  headerClassName: "bg-white",
                },
                {
                  key: "awaiting-receipt",
                  title: "納品待ち",
                  description: "発注記録済み・商品到着待ち",
                  rows: awaitingReceiptRows,
                  className: "border-green-100",
                  headerClassName: "bg-green-50/70",
                },
                {
                  key: "received",
                  title: "納品済み",
                  description: "納品確認済み",
                  rows: receivedRows,
                  className: "border-teal-100",
                  headerClassName: "bg-teal-50/70",
                },
                {
                  key: "skipped",
                  title: "見送り",
                  description: "今回は発注しないもの",
                  rows: skippedRows,
                  className: "border-line",
                  headerClassName: "bg-subtle/70",
                },
              ].filter((block) => block.rows.length > 0);
              const hasUnassignedSupplier = supplierRows.some((row) => !row.supplierId);
              const supplierStatusCounts = [
                {
                  status: "PLANNED" as const,
                  label: "発注予定",
                  count: supplierRows.filter((row) => printableOrderRequestStatuses.includes(row.status)).length,
                },
                {
                  status: "AWAITING_RECEIPT" as const,
                  label: "納品待ち",
                  count: supplierRows.filter((row) => row.status === "ORDERED" && !row.receivedAt).length,
                },
                {
                  status: "RECEIVED" as const,
                  label: "納品済み",
                  count: supplierRows.filter((row) => row.status === "ORDERED" && row.receivedAt).length,
                },
                {
                  status: "SKIPPED" as const,
                  label: "見送り",
                  count: supplierRows.filter((row) => row.status === "SKIPPED").length,
                },
              ]
                .filter((item) => item.count > 0);
              const primaryStatusCounts = supplierStatusCounts.filter((item) =>
                item.status === "PLANNED" || item.status === "AWAITING_RECEIPT",
              );

              return (
                <section
                  key={supplierKey}
                  className="overflow-hidden rounded border border-line/90 bg-white shadow-panel print:break-inside-avoid print:rounded-none print:border-black print:shadow-none"
                >
                <div className="flex flex-col gap-2 border-b border-line border-l-4 border-l-accent bg-teal-50/70 px-4 py-2 text-sm lg:flex-row lg:items-start lg:justify-between print:border-black print:border-l-black print:bg-white print:px-2 print:py-2 print:text-xs">
                  <div>
                    <h2 className="font-semibold">{supplierName}</h2>
                    <p className="mt-1 text-xs font-semibold text-muted print:text-black">
                      {formatSupplierLeadTime(supplierLeadTime)}
                    </p>
                    {hasUnassignedSupplier ? (
                      <p className="mt-1 text-xs font-semibold text-danger print:hidden">
                        発注先未設定の商品があります。商品マスタで主発注先を設定してください。
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-start justify-end gap-2">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <span className="rounded border border-line bg-white/80 px-2 py-1 text-xs font-semibold text-muted print:border-black print:text-black">
                        全 {supplierRows.length} 件
                      </span>
                      {primaryStatusCounts.map((item) => (
                        <span
                          key={item.status}
                          className={`rounded border px-2 py-1 text-xs font-semibold print:border-black print:bg-white print:text-black ${getSupplierStatusChipClass(
                            item.status,
                          )}`}
                        >
                          {item.label} {item.count}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 bg-subtle/30 p-3 print:bg-white print:p-0">
                  {rowBlocks.map((block) => (
                    <section
                      key={block.key}
                      className={`overflow-hidden rounded border bg-white print:break-inside-avoid print:rounded-none print:border-black ${block.className}`}
                    >
                      <div
                        className={`flex flex-col gap-2 border-b border-line px-3 py-2 text-sm lg:flex-row lg:items-start lg:justify-between print:border-black print:bg-white print:px-2 print:py-1.5 print:text-xs ${block.headerClassName}`}
                      >
                        <div>
                          <h3 className="font-semibold">{block.title}</h3>
                          <p className="mt-0.5 text-xs text-muted print:text-black">{block.description}</p>
                        </div>
                        <div className="flex flex-wrap items-start justify-end gap-2">
                          <span className="rounded border border-line bg-white/80 px-2 py-1 text-xs font-semibold text-muted print:border-black print:text-black">
                            {block.rows.length} 件
                          </span>
                          {block.key === "active" && activeRows.length > 0 ? (
                            <SupplierOrderRecordPanel
                              orderRequestIds={activeRows.map((row) => row.id)}
                              printHref={buildOrdersPrintHref(activeRows[0]?.supplierId)}
                            />
                          ) : null}
                        </div>
                      </div>
                      <OrderRequestRowsTable rows={block.rows} />
                    </section>
                  ))}
                </div>
                </section>
              );
            })
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
