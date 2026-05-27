import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getStocktakeSessionDetail, getStocktakeSessionStatusLabel } from "@/lib/db/stocktake-sessions";

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams?: Promise<{
    tab?: string;
  }>;
};

type HistoryTab = "diff" | "nodiff" | "pending";

const historyTabs: Array<{ id: HistoryTab; label: string }> = [
  { id: "diff", label: "差異あり" },
  { id: "nodiff", label: "差異なし" },
  { id: "pending", label: "未入力" },
];

function formatDateTime(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatDifference(diff: number | null) {
  if (diff === null) {
    return "-";
  }

  if (diff === 0) {
    return "差異なし";
  }

  return `${diff > 0 ? "+" : ""}${diff}`;
}

function getDiffClass(diff: number | null) {
  if (diff === null || diff === 0) {
    return "font-semibold text-accent";
  }

  return diff > 0 ? "font-semibold text-accent" : "font-semibold text-danger";
}

export default async function StocktakeSessionHistoryPage({ params, searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const { sessionId } = await params;
  const requestedTab = (await searchParams)?.tab;
  const currentTab: HistoryTab =
    requestedTab === "nodiff" || requestedTab === "pending" || requestedTab === "diff" ? requestedTab : "diff";
  const stocktakeSession = await getStocktakeSessionDetail(sessionId, context.clinicId);

  if (!stocktakeSession) {
    notFound();
  }

  const diffRows = stocktakeSession.rows.filter(
    (row) => row.status === "COUNTED" && row.diff !== null && row.diff !== 0,
  );
  const noDiffRows = stocktakeSession.rows.filter((row) => row.status === "COUNTED" && row.diff === 0);
  const pendingRows = stocktakeSession.rows.filter((row) => row.status === "PENDING");
  const rowsByTab = {
    diff: diffRows,
    nodiff: noDiffRows,
    pending: pendingRows,
  };
  const countsByTab = {
    diff: diffRows.length,
    nodiff: noDiffRows.length,
    pending: pendingRows.length,
  };
  const visibleRows = rowsByTab[currentTab];

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <AppNav current="stocktake" />

        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">棚卸セッション履歴</h1>
            <p className="mt-2 text-sm text-muted">
              確定済み・破棄済みセッションの入力内容と、確定時に作成された在庫履歴を確認します。
            </p>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href="/stocktake/sessions">
            セッション一覧へ戻る
          </a>
        </header>


        <section className="grid gap-3 rounded border border-line bg-white p-4 text-sm shadow-panel md:grid-cols-3">
          <div>
            <p className="text-muted">状態</p>
            <p className="mt-1 font-semibold">{getStocktakeSessionStatusLabel(stocktakeSession.status)}</p>
          </div>
          <div>
            <p className="text-muted">開始者</p>
            <p className="mt-1 font-semibold">{stocktakeSession.startedByUserName}</p>
          </div>
          <div>
            <p className="text-muted">確定者</p>
            <p className="mt-1 font-semibold">{stocktakeSession.committedByUserName ?? "-"}</p>
          </div>
          <div>
            <p className="text-muted">開始日時</p>
            <p className="mt-1 font-semibold">{formatDateTime(stocktakeSession.startedAt)}</p>
          </div>
          <div>
            <p className="text-muted">確定日時</p>
            <p className="mt-1 font-semibold">{formatDateTime(stocktakeSession.committedAt)}</p>
          </div>
          <div>
            <p className="text-muted">メモ</p>
            <p className="mt-1 font-semibold">{stocktakeSession.memo ?? "-"}</p>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          {historyTabs.map((tab) => (
            <a
              key={tab.id}
              href={`/stocktake/sessions/${stocktakeSession.id}/history?tab=${tab.id}`}
              className={
                currentTab === tab.id
                  ? "rounded bg-ink px-4 py-2 text-sm font-semibold text-white"
                  : "rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              }
            >
              {tab.label} {countsByTab[tab.id]}
            </a>
          ))}
        </div>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="border-b border-line px-4 py-3 text-sm text-muted">
            表示 {visibleRows.length} 件 / 全 {stocktakeSession.itemCount} 件。スキップ {stocktakeSession.skippedCount} 件。
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">商品</th>
                  <th className="border-b border-line px-4 py-3">保管場所</th>
                  <th className="border-b border-line px-4 py-3 text-right">期待</th>
                  <th className="border-b border-line px-4 py-3 text-right">実数</th>
                  <th className="border-b border-line px-4 py-3 text-right">差異</th>
                  <th className="border-b border-line px-4 py-3">入力者</th>
                  <th className="border-b border-line px-4 py-3">メモ</th>
                  <th className="border-b border-line px-4 py-3">関連履歴</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length > 0 ? (
                  visibleRows.map((row) => (
                    <tr key={row.id} className="align-top">
                      <td className="border-b border-line px-4 py-3">
                        <a className="font-semibold text-accent hover:underline" href={`/products/${row.productId}`}>
                          {row.name}
                        </a>
                        <p className="mt-1 text-xs text-muted">
                          {[row.category ?? "未分類", row.productCode ? `商品コード: ${row.productCode}` : null]
                            .filter(Boolean)
                            .join(" / ")}
                        </p>
                      </td>
                      <td className="border-b border-line px-4 py-3">{row.location ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3 text-right">{row.expectedQuantity}</td>
                      <td className="border-b border-line px-4 py-3 text-right">{row.countedQuantity ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3 text-right">
                        <span className={getDiffClass(row.diff)}>{formatDifference(row.diff)}</span>
                      </td>
                      <td className="border-b border-line px-4 py-3 text-muted">{row.countedByUserName ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3 text-muted">{row.memo ?? "-"}</td>
                      <td className="border-b border-line px-4 py-3">
                        {row.movementId ? (
                          <a
                            className="font-semibold text-accent hover:underline"
                            href={`/movements?source=STOCKTAKE_SESSION&sourceId=${stocktakeSession.id}`}
                          >
                            入出庫履歴
                          </a>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted" colSpan={8}>
                      この区分の明細はありません。
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
