import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import {
  getRecentStockMovementRows,
  getStockMovementSourceLabel,
  getStockMovementTypeLabel,
} from "@/lib/db/stock-movements";
import { MovementFilterForm } from "./movement-filter-form";
import { RevertMovementButton } from "./revert-movement-button";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    type?: string;
    source?: string;
    sourceId?: string;
  }>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

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

const movementTypes = new Set(["IN", "OUT", "ADJUST"]);
const movementSources = new Set(["MANUAL", "QUICK_CARD", "BARCODE_STOCK", "STOCKTAKE", "STOCKTAKE_SESSION", "REVERT"]);

export default async function MovementsPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const movementType = movementTypes.has(params.type ?? "") ? (params.type ?? "") : "";
  const sourceType = movementSources.has(params.source ?? "") ? (params.source ?? "") : "";
  const sourceId = params.sourceId?.trim() ?? "";
  const movements = await getRecentStockMovementRows(context.clinicId);
  const normalizedQuery = query.toLowerCase();
  const filteredMovements = movements.filter((movement) => {
    const searchText = [
      movement.productName,
      movement.productCode,
      movement.category,
      movement.reason,
      movement.userName,
      getStockMovementTypeLabel(movement.movementType),
      getStockMovementSourceLabel(movement.sourceType),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = normalizedQuery ? searchText.includes(normalizedQuery) : true;
    const matchesType = movementType ? movement.movementType === movementType : true;
    const matchesSource = sourceType ? movement.sourceType === sourceType : true;
    const matchesSourceId = sourceId ? movement.sourceId === sourceId : true;

    return matchesQuery && matchesType && matchesSource && matchesSourceId;
  });
  const filterLabel = [
    query ? `検索: ${query}` : "",
    movementType ? `区分: ${getStockMovementTypeLabel(movementType)}` : "",
    sourceType ? `操作元: ${getStockMovementSourceLabel(sourceType)}` : "",
    sourceId ? "棚卸セッション指定あり" : "",
  ]
    .filter(Boolean)
    .join(" / ");
  const emptyMessage =
    movements.length === 0
      ? "まだ入出庫履歴はありません。"
      : "条件に一致する入出庫履歴はありません。検索語や絞り込みを見直してください。";

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">入出庫履歴</h1>
          </div>
          <a className="inline-flex h-11 shrink-0 items-center justify-center rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent" href="/home">
            ホームへ戻る
          </a>
        </header>

        <AppNav current="movements" />

        <MovementFilterForm defaultQuery={query} defaultType={movementType} defaultSource={sourceType} />

        <section className="rounded border border-line bg-white px-4 py-3 text-sm text-muted shadow-panel">
          表示 {filteredMovements.length} 件 / 全 {movements.length} 件
          {filterLabel ? `（${filterLabel}）` : ""}
        </section>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">日時</th>
                  <th className="border-b border-line px-4 py-3">商品</th>
                  <th className="border-b border-line px-4 py-3">区分</th>
                  <th className="border-b border-line px-4 py-3 text-right">増減</th>
                  <th className="border-b border-line px-4 py-3 text-right">変更前</th>
                  <th className="border-b border-line px-4 py-3 text-right">変更後</th>
                  <th className="border-b border-line px-4 py-3">理由メモ</th>
                  <th className="border-b border-line px-4 py-3">操作元</th>
                  <th className="border-b border-line px-4 py-3">操作者</th>
                  <th className="border-b border-line px-4 py-3">取り消し</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length > 0 ? (
                  filteredMovements.map((movement) => {
                    const canRevert =
                      !movement.revertedAt && !movement.revertOfId && movement.sourceType !== "STOCKTAKE_SESSION";

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
                        <td className="border-b border-line px-4 py-3">
                          <span className={`rounded px-2 py-1 text-xs font-semibold ${getMovementBadgeClass(movement.movementType)}`}>
                            {getStockMovementTypeLabel(movement.movementType)}
                          </span>
                        </td>
                        <td className="border-b border-line px-4 py-3 text-right font-semibold">
                          {formatSignedQuantity(movement.quantity)}
                        </td>
                        <td className="border-b border-line px-4 py-3 text-right">{movement.beforeQuantity}</td>
                        <td className="border-b border-line px-4 py-3 text-right">{movement.afterQuantity}</td>
                        <td className="border-b border-line px-4 py-3 text-muted">{movement.reason ?? "-"}</td>
                        <td className="border-b border-line px-4 py-3 text-muted">
                          {getStockMovementSourceLabel(movement.sourceType)}
                          {movement.sourceType === "STOCKTAKE_SESSION" ? (
                            <p className="mt-1 text-xs text-danger">棚卸セッション由来は対象外</p>
                          ) : null}
                          {movement.revertedAt ? <p className="mt-1 text-xs text-muted">取り消し済み</p> : null}
                          {movement.revertOfId ? <p className="mt-1 text-xs text-muted">取り消し操作</p> : null}
                        </td>
                        <td className="border-b border-line px-4 py-3 text-muted">{movement.userName}</td>
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
                    <td className="px-4 py-12 text-center text-muted" colSpan={10}>
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
