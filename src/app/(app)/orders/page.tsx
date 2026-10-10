import { SectionHeading } from "@/components/ui/section-heading";
import { PageHeader } from "@/components/ui/page-header";
import { OrdersHeaderMenu } from "./orders-header-menu";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/ui/page-shell";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getOrderRequestRows, type OrderRequestRow } from "@/lib/db/orders";
import { getActiveStaffOperatorOptionsForClinic, type StaffOperatorOption } from "@/lib/db/staff-operators";
import { getSupplierLeadTimes, type SupplierLeadTimeStats } from "@/lib/db/supplier-lead-times";
import { orderPrintUnassignedSupplierId } from "@/lib/orders/print";
import {
  printableOrderRequestStatuses,
  type OrderRequestStatusValue,
} from "@/lib/orders/status";
import { OrderRequestTableRow } from "./order-request-row";
import { OrderStatusBlock } from "./order-status-block";
import { OrdersPrintButton } from "./print-button";
import { SupplierOrderRecordPanel } from "./supplier-order-record-panel";
import { SupplierSuggestionConfirm } from "./supplier-suggestion-confirm";

type OrderListFilterValue = "ALL" | "SUGGESTED" | "PLANNED" | "AWAITING_RECEIPT" | "RECEIVED" | "SKIPPED";
type OrderStatusFilterValue = Exclude<OrderListFilterValue, "ALL">;

const defaultOrderListFilter: OrderListFilterValue = "ALL";

const statusFilters: { label: string; value: OrderListFilterValue }[] = [
  {
    label: "すべて",
    value: "ALL",
  },
  {
    label: "確認待ち",
    value: "SUGGESTED",
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
const orderRequestStatusRank = Object.fromEntries(["SUGGESTED", "CONFIRMED", "DRAFT", "ORDERED", "SKIPPED"].map((status, index) => [status, index])) as Record<
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

  if (status !== defaultOrderListFilter) {
    params.set("status", status);
  }

  const queryString = params.toString();

  return queryString ? `/orders?${queryString}` : "/orders";
}

function buildOrdersPrintHref(supplierId: string | null | undefined) {
  const selectedSupplierId = supplierId ?? orderPrintUnassignedSupplierId;

  return `/orders/print?supplierId=${encodeURIComponent(selectedSupplierId)}`;
}

function getSupplierStatusChipClass(status: OrderStatusFilterValue) {
  if (status === "SUGGESTED") {
    return "border-line bg-tint text-accent";
  }
  if (status === "SKIPPED") {
    return "border-line bg-subtle text-muted";
  }

  if (status === "AWAITING_RECEIPT") {
    return "border-line border-l-4 border-l-ink bg-markSoft text-ink";
  }

  if (status === "RECEIVED") {
    return "border-line bg-panel text-success";
  }

  if (status === "PLANNED") {
    return "border-line bg-tint text-accent";
  }

  return "border-line bg-panel/80 text-muted";
}

function getStatusFilterClass(_status: OrderListFilterValue, isCurrent: boolean) {
  const baseClass = "inline-flex min-h-10 items-center rounded border px-4 py-2 text-sm font-semibold transition";
  return `${baseClass} ${isCurrent ? "chip-selected border-accent" : "border-lineStrong bg-panel text-ink hover:bg-tint"}`;
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
  if (filter === "ALL") {
    return true;
  }

  if (filter === "PLANNED") {
    return printableOrderRequestStatuses.includes(row.status);
  }

  if (filter === "SUGGESTED") return row.status === "SUGGESTED";

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

function OrderRequestRowsTable({
  clinicId,
  rows,
  staffOperators,
}: {
  clinicId: string;
  rows: OrderRequestRow[];
  staffOperators: StaffOperatorOption[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="order-rows w-full border-collapse text-left text-sm print:text-xs">
        <colgroup className="print:hidden">
          <col className="w-[20%]" />
          <col className="w-[16%]" />
          <col className="w-[20%]" />
          <col className="w-[20%]" />
          <col className="w-[24%]" />
        </colgroup>
        <thead className="bg-tint text-label text-accent print:bg-panel print:text-label print:text-ink">
          <tr>
            <th className="border-b border-accent px-4 py-3 print:border print:border-ink print:px-2 print:py-1.5">
              商品
            </th>
            <th className="border-b border-accent px-4 py-3 print:border print:border-ink print:px-2 print:py-1.5">
              在庫状況
            </th>
            <th className="border-b border-accent px-4 py-3 print:border print:border-ink print:px-2 print:py-1.5">
              発注先
            </th>
            <th className="border-b border-accent px-4 py-3 print:border print:border-ink print:px-2 print:py-1.5">
              発注量
            </th>
            <th className="border-b border-accent px-4 py-3 print:hidden">記録・操作</th>
            <th className="hidden border border-ink px-2 py-1.5 print:table-cell">状態</th>
            <th className="hidden border border-ink px-2 py-1.5 print:table-cell">備考</th>
            <th className="hidden border border-ink px-2 py-1.5 print:table-cell">確認</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <OrderRequestTableRow
              key={`${row.id}-${row.status}-${row.requestedQuantity}-${row.memo ?? ""}-${row.orderedMethod ?? ""}-${row.orderedMemo ?? ""}-${row.supplierResponseMemo ?? ""}-${row.receivedAt?.getTime() ?? ""}-${row.receivedQuantity ?? ""}-${row.receivedMemo ?? ""}`}
              clinicId={clinicId}
              row={row}
              staffOperators={staffOperators}
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
    : defaultOrderListFilter;
  const selectedStatusLabel = statusFilters.find((filter) => filter.value === selectedStatus)?.label ?? "";
  const [rows, supplierLeadTimes, staffOperators] = await Promise.all([
    getOrderRequestRows(context.clinicId),
    getSupplierLeadTimes(context.organizationId),
    getActiveStaffOperatorOptionsForClinic({
      organizationId: context.organizationId,
      clinicId: context.clinicId,
    }),
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
      status: "SUGGESTED" as const,
      label: "確認待ち",
      count: queryFilteredRows.filter((row) => row.status === "SUGGESTED").length,
    },
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
    OrderStatusFilterValue,
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
  const hasFilter = Boolean(query || selectedStatusLabel);
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
    <PageShell current="orders" mainClassName="pt-3 pb-6 print:bg-panel print:p-0" shellClassName="print:bg-panel">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 print:max-w-none print:gap-3">

        <PageHeader title={"発注"} className="print:border-b print:border-ink print:pb-3">
          <p className="orders-issued-at mt-2 text-sm text-muted print:text-xs print:text-ink">
            <span className="hidden print:inline">この一覧は発注前の確認用で、外部発注送信済みではありません。</span>
            発行日時: {generatedAt}
          </p>
          <OrdersHeaderMenu />
          <div className="hidden w-full gap-2 overflow-x-auto pb-1 print:hidden sm:flex md:w-auto md:justify-end md:overflow-visible md:pb-0">
            <a className="inline-flex h-10 shrink-0 items-center justify-center rounded btn-secondary px-3 text-sm font-semibold transition" href="/shortage">
              不足一覧へ
            </a>
            <a
              className="inline-flex h-10 shrink-0 items-center justify-center rounded btn-secondary px-3 text-sm font-semibold transition"
              href="/orders/print"
            >
              発注書下書き
            </a>
            <a
              className="inline-flex h-10 shrink-0 items-center justify-center rounded btn-secondary px-3 text-sm font-semibold transition"
              href="/order-records"
            >
              発注記録
            </a>
            <OrdersPrintButton />
          </div>
        </PageHeader>


        <section className="hidden grid-cols-4 gap-2 text-xs print:grid">
          <div className="border border-ink px-2 py-1.5">印刷対象: {filteredRows.length} 件</div>
          <div className="border border-ink px-2 py-1.5">検索後: {queryFilteredRows.length} 件</div>
          <div className="border border-ink px-2 py-1.5">発注予定: {countByStatus.PLANNED} 件</div>
          <div className="border border-ink px-2 py-1.5">納品待ち: {countByStatus.AWAITING_RECEIPT} 件</div>
        </section>
        <section className="hidden border border-ink px-2 py-1.5 text-xs print:block">
          出力条件: {filterLabel || "すべて"} / 全発注候補: {rows.length} 件 / 納品済み: {countByStatus.RECEIVED} 件 / 見送り:{" "}
          {countByStatus.SKIPPED} 件
        </section>

        <form className="flex items-center gap-2 rounded border border-line/90 bg-panel/95 p-3 shadow-sheet print:hidden">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="商品名・商品コード・カテゴリ・発注先・メモ"
            className="h-10 min-w-0 flex-1 rounded border border-line bg-panel/90 px-3 text-sm"
          />
          {selectedStatus !== defaultOrderListFilter ? <input type="hidden" name="status" value={selectedStatus} /> : null}
          <button
            type="submit"
            className="h-10 rounded btn-primary px-4 text-sm font-semibold transition"
          >
            検索
          </button>
          <a
            className="inline-flex min-h-10 shrink-0 items-center px-2 text-sm font-semibold text-accent underline transition"
            href={buildOrdersHref(selectedStatus, "")}
          >
            クリア
          </a>
        </form>

        <section className="flex flex-wrap gap-2 print:hidden">
          {statusFilters.map((filter) => {
            const isCurrent = filter.value === selectedStatus;
            const count = filter.value === "ALL" ? queryFilteredRows.length : countByStatus[filter.value];
            const isAttentionCount = count > 0 && (filter.value === "SUGGESTED" || filter.value === "AWAITING_RECEIPT");

            return (
              <a
                key={filter.value}
                href={buildOrdersHref(filter.value, query)}
                aria-current={isCurrent ? "page" : undefined}
                className={getStatusFilterClass(filter.value, isCurrent)}
              >
                {filter.label}{" "}
                <span className={`ml-1 tabular-nums ${isAttentionCount ? "rounded-sm bg-mark px-1 text-ink" : count === 0 && !isCurrent ? "text-muted" : ""}`}>
                  {count}<span className="sr-only">件</span>
                </span>
              </a>
            );
          })}
        </section>

        <section className="hidden grid-cols-2 gap-3 text-xs print:grid">
          <div className="min-h-12 border border-ink px-3 py-2">発注前確認</div>
          <div className="min-h-12 border border-ink px-3 py-2">印刷備考</div>
        </section>

        <section className="flex flex-col gap-3 print:gap-3">
          <div className="rounded border border-line/90 bg-panel/95 px-4 py-2 text-sm text-muted shadow-sheet print:rounded-none print:border-ink print:px-2 print:py-2 print:text-xs print:text-ink print:shadow-none">
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
              const suggestedRows = sortRowsByStatusFlow(supplierRows.filter((row) => row.status === "SUGGESTED"));
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
                  headerClassName: "bg-panel",
                },
                {
                  key: "awaiting-receipt",
                  title: "納品待ち",
                  description: "発注記録済み・商品到着待ち",
                  rows: awaitingReceiptRows,
                  className: "border-line",
                  headerClassName: "bg-markSoft",
                },
                {
                  key: "received",
                  title: "納品済み",
                  description: "納品確認済み",
                  rows: receivedRows,
                  className: "border-line",
                  headerClassName: "bg-panel",
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
                  status: "SUGGESTED" as const,
                  label: "確認待ち",
                  count: supplierRows.filter((row) => row.status === "SUGGESTED").length,
                },
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
                item.status === "SUGGESTED" || item.status === "PLANNED" || item.status === "AWAITING_RECEIPT",
              );

              return (
                <section
                  key={supplierKey}
                  className="overflow-hidden rounded border border-line/90 bg-panel shadow-sheet print:break-inside-avoid print:rounded-none print:border-ink print:shadow-none"
                >
                <div className="flex flex-col gap-3 border-b border-line border-l-8 border-l-accent bg-tint px-5 py-3 text-sm lg:flex-row lg:items-start lg:justify-between print:border-ink print:border-l-black print:bg-panel print:px-2 print:py-2 print:text-xs">
                  <div>
                    <SectionHeading>{supplierName}</SectionHeading>
                    <p className="mt-1 text-xs font-semibold text-muted print:text-ink">
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
                      <span className="rounded border border-line bg-panel/80 px-2 py-1 text-xs font-semibold text-muted print:border-ink print:text-ink">
                        全 {supplierRows.length} 件
                      </span>
                      {primaryStatusCounts.map((item) => (
                        <span
                          key={item.status}
                          className={`rounded border px-2 py-1 text-label font-semibold print:border-ink print:bg-panel print:text-ink ${getSupplierStatusChipClass(
                            item.status,
                          )}`}
                        >
                          {item.label} {item.count}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 bg-subtle/30 p-3 print:bg-panel print:p-0">
                  <SupplierSuggestionConfirm orderRequestIds={suggestedRows.map((row) => row.id)}>
                    <OrderRequestRowsTable
                      clinicId={context.clinicId}
                      rows={suggestedRows}
                      staffOperators={staffOperators}
                    />
                  </SupplierSuggestionConfirm>
                  {rowBlocks.map((block) => (
                    <OrderStatusBlock
                      key={block.key}
                      title={block.title}
                      description={block.description}
                      count={block.rows.length}
                      className={block.className}
                      headerClassName={block.headerClassName}
                      foldInitially={selectedStatus === "ALL" && (block.key === "received" || block.key === "skipped")}
                      action={block.key === "active" && activeRows.length > 0 ? (
                        <SupplierOrderRecordPanel
                          clinicId={context.clinicId}
                          orderRequestIds={activeRows.map((row) => row.id)}
                          printHref={buildOrdersPrintHref(activeRows[0]?.supplierId)}
                          staffOperators={staffOperators}
                        />
                      ) : null}
                    >
                      <OrderRequestRowsTable
                        clinicId={context.clinicId}
                        rows={block.rows}
                        staffOperators={staffOperators}
                      />
                    </OrderStatusBlock>
                  ))}
                </div>
                </section>
              );
            })
          ) : (
            <div className="rounded border border-line bg-panel px-4 py-12 text-center text-sm text-muted shadow-sheet print:border-ink print:shadow-none">
              {emptyMessage}
            </div>
          )}
        </section>

        <p className="hidden text-xs leading-5 text-ink print:block">
          発注数量、発注先、状態、備考を確認してください。
        </p>
      </div>
    </PageShell>
  );
}
