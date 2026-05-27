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
    return "bg-emerald-50 text-accent";
  }

  if (movementType === "OUT") {
    return "bg-red-50 text-danger";
  }

  return "bg-gray-100 text-muted";
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
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">本部ダッシュボード / 入出庫履歴</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">{detail.clinic.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              この画面は読み取り専用です。最近の入庫、出庫、調整履歴を確認できます。
            </p>
          </div>
          <a
            className="inline-flex h-11 shrink-0 items-center justify-center rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            href={`/admin/overview/${clinicId}`}
          >
            クリニック詳細へ戻る
          </a>
        </header>

        <section className="rounded border border-line bg-white p-4 shadow-panel">
          <form
            className="grid gap-3 lg:grid-cols-[1fr_160px_220px_160px_160px_auto]"
            action={`/admin/overview/${clinicId}/movements`}
          >
            <input
              className="h-11 rounded border border-line bg-white px-3 text-base text-ink outline-none transition placeholder:text-muted focus:border-accent"
              defaultValue={filters.query}
              name="q"
              placeholder="商品名、カテゴリ、理由、操作者"
              type="search"
            />
            <select
              className="h-11 rounded border border-line bg-white px-3 text-base text-ink outline-none transition focus:border-accent"
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
              className="h-11 rounded border border-line bg-white px-3 text-base text-ink outline-none transition focus:border-accent"
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
              className="h-11 rounded border border-line bg-white px-3 text-base text-ink outline-none transition focus:border-accent"
              defaultValue={filters.startDate}
              name="startDate"
              type="date"
            />
            <input
              className="h-11 rounded border border-line bg-white px-3 text-base text-ink outline-none transition focus:border-accent"
              defaultValue={filters.endDate}
              name="endDate"
              type="date"
            />
            <button
              className="h-11 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
              type="submit"
            >
              表示
            </button>
          </form>
          <div className="mt-3">
            <a
              className="inline-flex h-9 items-center rounded border border-line px-3 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              href={`/admin/overview/${clinicId}/movements`}
            >
              条件をクリア
            </a>
          </div>
        </section>

        <section className="rounded border border-line bg-white px-5 py-4 text-sm text-muted shadow-panel">
          表示 {movements.length} 件 / 条件一致 {movementCount} 件
          {filterLabel ? `（${filterLabel}）` : ""}
          {movementCount > movements.length ? " / 画面表示は最新100件までです。" : ""}
        </section>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">日時</th>
                  <th className="border-b border-line px-4 py-3">商品</th>
                  <th className="border-b border-line px-4 py-3">区分</th>
                  <th className="border-b border-line px-4 py-3 text-right">増減</th>
                  <th className="border-b border-line px-4 py-3 text-right">変更前</th>
                  <th className="border-b border-line px-4 py-3 text-right">変更後</th>
                  <th className="border-b border-line px-4 py-3">理由</th>
                  <th className="border-b border-line px-4 py-3">操作元</th>
                  <th className="border-b border-line px-4 py-3">操作者</th>
                  <th className="border-b border-line px-4 py-3">実作業者</th>
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
