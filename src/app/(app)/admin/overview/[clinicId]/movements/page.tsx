import { PageHeader } from "@/components/ui/page-header";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminOverviewClinicDetail } from "@/lib/db/admin-overview";
import {
  getStockMovementCount,
  getStockMovementRows,
  getStockMovementSourceLabel,
  getStockMovementTypeLabel,
  normalizeStockMovementFilters,
  stockMovementSources,
  stockMovementTypes,
} from "@/lib/db/stock-movements";

type PageProps = {
  params: Promise<{
    clinicId: string;
  }>;
  searchParams?: Promise<{
    q?: string;
    type?: string;
    source?: string;
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

const movementTypeOptions = Array.from(stockMovementTypes);
const movementSourceOptions = Array.from(stockMovementSources);

function formatSignedQuantity(quantity: number) {
  return quantity > 0 ? `+${quantity}` : `${quantity}`;
}

function getMovementBadgeClass(movementType: string) {
  if (movementType === "IN") {
    return "bg-panel text-accent";
  }

  if (movementType === "OUT") {
    return "bg-panel text-danger";
  }

  return "bg-subtle text-muted";
}

export default async function AdminOverviewClinicMovementsPage({ params, searchParams }: PageProps) {
  const context = await requireAdminUser();
  const { clinicId } = await params;
  const selectedParams = (await searchParams) ?? {};
  const filters = normalizeStockMovementFilters({
    query: selectedParams.q,
    movementType: selectedParams.type,
    sourceType: selectedParams.source,
    startDate: selectedParams.startDate,
    endDate: selectedParams.endDate,
  });
  const detail = await getAdminOverviewClinicDetail(context.organizationId, clinicId);

  if (!detail) {
    notFound();
  }

  const [movements, movementCount] = await Promise.all([
    getStockMovementRows(clinicId, filters, 100),
    getStockMovementCount(clinicId, filters),
  ]);
  const filterLabel = [
    filters.query ? `検索: ${filters.query}` : "",
    filters.movementType ? `区分: ${getStockMovementTypeLabel(filters.movementType)}` : "",
    filters.sourceType ? `操作元: ${getStockMovementSourceLabel(filters.sourceType)}` : "",
    filters.startDate ? `開始日: ${filters.startDate}` : "",
    filters.endDate ? `終了日: ${filters.endDate}` : "",
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <>
      <AppNav current="overview" />
      <main className="mx-auto grid w-full max-w-7xl gap-3 px-3 pt-3 pb-6 lg:px-6">
        <PageHeader title={detail.clinic.name}>
          <div>
            <p className="text-sm font-semibold text-accent">本部ダッシュボード / 入出庫履歴</p>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              この画面は読み取り専用です。最近の入庫、出庫、調整履歴を確認できます。
            </p>
          </div>
          <a
            className="inline-flex h-11 shrink-0 items-center justify-center rounded btn-secondary px-4 text-sm font-semibold transition"
            href={`/admin/overview/${clinicId}`}
          >
            クリニック詳細へ戻る
          </a>
        </PageHeader>

        <section className="rounded border border-line bg-panel p-4 shadow-sheet">
          <form
            className="grid gap-3 lg:grid-cols-[1fr_160px_220px_160px_160px_auto]"
            action={`/admin/overview/${clinicId}/movements`}
          >
            <input
              className="h-11 rounded border border-line bg-panel px-3 text-base text-ink  transition placeholder:text-muted "
              defaultValue={filters.query}
              name="q"
              placeholder="商品名、カテゴリ、理由、操作者"
              type="search"
            />
            <select
              className="h-11 rounded border border-line bg-panel px-3 text-base text-ink  transition "
              defaultValue={filters.movementType}
              name="type"
            >
              <option value="">区分すべて</option>
              {movementTypeOptions.map((movementType) => (
                <option key={movementType} value={movementType}>
                  {getStockMovementTypeLabel(movementType)}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded border border-line bg-panel px-3 text-base text-ink  transition "
              defaultValue={filters.sourceType}
              name="source"
            >
              <option value="">操作元すべて</option>
              {movementSourceOptions.map((sourceType) => (
                <option key={sourceType} value={sourceType}>
                  {getStockMovementSourceLabel(sourceType)}
                </option>
              ))}
            </select>
            <input
              className="h-11 rounded border border-line bg-panel px-3 text-base text-ink  transition "
              defaultValue={filters.startDate}
              name="startDate"
              type="date"
            />
            <input
              className="h-11 rounded border border-line bg-panel px-3 text-base text-ink  transition "
              defaultValue={filters.endDate}
              name="endDate"
              type="date"
            />
            <button
              className="h-11 rounded btn-primary px-5 text-sm font-semibold transition"
              type="submit"
            >
              表示
            </button>
          </form>
          <div className="mt-3">
            <a
              className="inline-flex h-9 items-center rounded btn-secondary px-3 text-sm font-semibold transition"
              href={`/admin/overview/${clinicId}/movements`}
            >
              条件をクリア
            </a>
          </div>
        </section>

        <section className="rounded border border-line bg-panel px-5 py-4 text-sm text-muted shadow-sheet">
          表示 {movements.length} 件 / 条件一致 {movementCount} 件
          {filterLabel ? `（${filterLabel}）` : ""}
          {movementCount > movements.length ? " / 画面表示は最新100件までです。" : ""}
        </section>

        <section className="overflow-hidden rounded border border-line bg-panel shadow-sheet">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] border-collapse text-left text-sm">
              <thead className="bg-tint text-label text-accent">
                <tr>
                  <th className="border-b border-accent px-4 py-3">日時</th>
                  <th className="border-b border-accent px-4 py-3">商品</th>
                  <th className="border-b border-accent px-4 py-3">区分</th>
                  <th className="border-b border-accent px-4 py-3 text-right">増減</th>
                  <th className="border-b border-accent px-4 py-3 text-right">変更前</th>
                  <th className="border-b border-accent px-4 py-3 text-right">変更後</th>
                  <th className="border-b border-accent px-4 py-3">理由</th>
                  <th className="border-b border-accent px-4 py-3">操作元</th>
                  <th className="border-b border-accent px-4 py-3">操作者</th>
                  <th className="border-b border-accent px-4 py-3">実作業者</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id} className="align-top">
                    <td className="border-b border-line px-4 py-3 text-muted">
                      {dateTimeFormatter.format(movement.createdAt)}
                    </td>
                    <td className="border-b border-line px-4 py-3">
                      <p className="font-semibold text-ink">{movement.productName}</p>
                      <p className="mt-1 text-xs text-muted">
                        {movement.productCode ?? "-"} / {movement.category ?? "-"}
                      </p>
                    </td>
                    <td className="border-b border-line px-4 py-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded px-2 py-1 text-xs font-semibold ${getMovementBadgeClass(
                          movement.movementType,
                        )}`}
                      >
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
                          {movement.expiryDateText || movement.expiryDate?.toLocaleDateString("ja-JP") || "-"}
                        </p>
                      ) : null}
                    </td>
                    <td className="border-b border-line px-4 py-3 text-muted">
                      {getStockMovementSourceLabel(movement.sourceType)}
                    </td>
                    <td className="border-b border-line px-4 py-3 text-muted">{movement.userName}</td>
                    <td className="border-b border-line px-4 py-3 text-muted">
                      {movement.performedByStaffName ?? "-"}
                    </td>
                  </tr>
                ))}
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-8 text-center text-muted">
                      条件に合う入出庫履歴はありません。
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
