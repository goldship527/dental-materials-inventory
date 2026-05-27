import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getProductCategories } from "@/lib/db/products";
import {
  getStockMovementCount,
  getStockMovementRows,
  getStockMovementSourceLabel,
  getStockMovementTypeLabel,
  normalizeStockMovementFilters,
} from "@/lib/db/stock-movements";
import { MovementFilterForm } from "./movement-filter-form";
import { RevertMovementButton } from "./revert-movement-button";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    type?: string;
    source?: string;
    sourceId?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
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
const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatSignedQuantity(quantity: number) {
  return quantity > 0 ? `+${quantity}` : `${quantity}`;
}

function formatLotExpiryDate(expiryDate: Date | null, expiryDateText: string | null | undefined) {
  if (expiryDate) {
    return dateFormatter.format(expiryDate);
  }

  return expiryDateText || "-";
}

function getMovementBadgeClass(movementType: string) {
  if (movementType === "IN") {
    return "bg-emerald-50 text-accent";
  }

  if (movementType === "OUT") {
    return "bg-red-50 text-danger";
  }

  return "bg-gray-100 text-muted";
}

function buildMovementExportHref(filters: {
  query: string;
  movementType: string;
  sourceType: string;
  sourceId: string;
  category: string;
  startDate: string;
  endDate: string;
}) {
  const params = new URLSearchParams();

  if (filters.query) {
    params.set("q", filters.query);
  }

  if (filters.movementType) {
    params.set("type", filters.movementType);
  }

  if (filters.sourceType) {
    params.set("source", filters.sourceType);
  }

  if (filters.sourceId) {
    params.set("sourceId", filters.sourceId);
  }

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.startDate) {
    params.set("startDate", filters.startDate);
  }

  if (filters.endDate) {
    params.set("endDate", filters.endDate);
  }

  const queryString = params.toString();

  return queryString ? `/movements/export?${queryString}` : "/movements/export";
}

export default async function MovementsPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const filters = normalizeStockMovementFilters({
    query: params.q,
    movementType: params.type,
    sourceType: params.source,
    sourceId: params.sourceId,
    category: params.category,
    startDate: params.startDate,
    endDate: params.endDate,
  });
  const movements = await getStockMovementRows(context.clinicId, filters);
  const movementCount = await getStockMovementCount(context.clinicId, filters);
  const categories = await getProductCategories(context.organizationId).catch(() => []);
  const exportHref = buildMovementExportHref(filters);
  const filterLabel = [
    filters.query ? `検索: ${filters.query}` : "",
    filters.movementType ? `区分: ${getStockMovementTypeLabel(filters.movementType)}` : "",
    filters.sourceType ? `操作元: ${getStockMovementSourceLabel(filters.sourceType)}` : "",
    filters.category ? `カテゴリ: ${filters.category}` : "",
    filters.startDate ? `開始日: ${filters.startDate}` : "",
    filters.endDate ? `終了日: ${filters.endDate}` : "",
    filters.sourceId ? "棚卸セッション指定あり" : "",
  ]
    .filter(Boolean)
    .join(" / ");
  const emptyMessage =
    movementCount === 0
      ? "まだ入出庫履歴はありません。"
      : "条件に一致する入出庫履歴はありません。検索語や絞り込みを見直してください。";

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppNav current="movements" />

        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">入出庫履歴</h1>
          </div>
          <a className="inline-flex h-11 shrink-0 items-center justify-center rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent" href="/home">
            ホームへ戻る
          </a>
        </header>


        <MovementFilterForm
          defaultQuery={filters.query}
          defaultType={filters.movementType}
          defaultSource={filters.sourceType}
          defaultCategory={filters.category}
          defaultStartDate={filters.startDate}
          defaultEndDate={filters.endDate}
          categories={categories}
          exportHref={exportHref}
        />

        <section className="rounded border border-line bg-white px-4 py-3 text-sm text-muted shadow-panel">
          表示 {movements.length} 件 / 条件一致 {movementCount} 件
          {filterLabel ? `（${filterLabel}）` : ""}
          {movementCount > movements.length ? " / 画面表示は最新100件までです" : ""}
        </section>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">日時</th>
                  <th className="border-b border-line px-4 py-3">商品</th>
                  <th className="w-24 border-b border-line px-4 py-3">区分</th>
                  <th className="border-b border-line px-4 py-3 text-right">増減</th>
                  <th className="border-b border-line px-4 py-3 text-right">変更前</th>
                  <th className="border-b border-line px-4 py-3 text-right">変更後</th>
                  <th className="border-b border-line px-4 py-3">理由メモ</th>
                  <th className="border-b border-line px-4 py-3">操作元</th>
                  <th className="border-b border-line px-4 py-3">操作者</th>
                  <th className="border-b border-line px-4 py-3">実作業者</th>
                  <th className="border-b border-line px-4 py-3">取り消し</th>
                </tr>
              </thead>
              <tbody>
                {movements.length > 0 ? (
                  movements.map((movement) => {
                    const canRevert =
                      !movement.revertedAt &&
                      !movement.revertOfId &&
                      movement.sourceType !== "STOCKTAKE_SESSION" &&
                      movement.sourceType !== "ORDER_RECEIPT" &&
                      movement.sourceType !== "ORDER_RECEIPT_REVERT";

                    return (
                      <tr key={movement.id} className="align-top">
                        <td className="border-b border-line px-4 py-3 text-muted">
                          {dateTimeFormatter.format(movement.createdAt)}
                        </td>
                        <td className="border-b border-line px-4 py-3">
                          <a className="font-semibold text-accent hover:underline" href={`/products/${movement.productId}`}>
                            {movement.productName}
                          </a>
                          <p className="mt-1 text-xs text-muted">
                            {movement.productCode ?? "コード未設定"} / {movement.category ?? "未分類"}
                          </p>
                        </td>
                        <td className="w-24 border-b border-line px-4 py-3">
                          <span className={`inline-flex whitespace-nowrap rounded px-2 py-1 text-xs font-semibold ${getMovementBadgeClass(movement.movementType)}`}>
                            {getStockMovementTypeLabel(movement.movementType)}
                          </span>
                        </td>
                        <td className="border-b border-line px-4 py-3 text-right font-semibold">
                          {formatSignedQuantity(movement.quantity)}
                        </td>
                        <td className="border-b border-line px-4 py-3 text-right">{movement.beforeQuantity}</td>
                        <td className="border-b border-line px-4 py-3 text-right">{movement.afterQuantity}</td>
                        <td className="border-b border-line px-4 py-3 text-muted">
                          {movement.reason ?? "-"}
                          {movement.lotNumber || movement.expiryDateText || movement.expiryDate ? (
                            <p className="mt-1 text-xs">
                              ロット {movement.lotNumber || "-"} / 有効期限{" "}
                              {formatLotExpiryDate(movement.expiryDate, movement.expiryDateText)}
                            </p>
                          ) : null}
                        </td>
                        <td className="border-b border-line px-4 py-3 text-muted">
                          {getStockMovementSourceLabel(movement.sourceType)}
                          {movement.sourceType === "STOCKTAKE_SESSION" ? (
                            <p className="mt-1 text-xs text-danger">棚卸確定の履歴は取り消せません</p>
                          ) : null}
                          {movement.revertedAt ? <p className="mt-1 text-xs text-muted">取り消し済み</p> : null}
                          {movement.revertOfId ? <p className="mt-1 text-xs text-muted">取り消し操作</p> : null}
                        </td>
                        <td className="border-b border-line px-4 py-3 text-muted">{movement.userName}</td>
                        <td className="border-b border-line px-4 py-3 text-muted">{movement.performedByStaffName ?? "-"}</td>
                        <td className="border-b border-line px-4 py-3">
                          {canRevert ? (
                            <RevertMovementButton
                              movementId={movement.id}
                              productName={movement.productName}
                              beforeQuantity={movement.beforeQuantity}
                              afterQuantity={movement.afterQuantity}
                            />
                          ) : (
                            <span className="text-xs text-muted">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted" colSpan={11}>
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
