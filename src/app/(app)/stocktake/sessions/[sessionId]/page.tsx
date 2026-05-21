import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getStocktakeSessionDetail, getStocktakeSessionStatusLabel } from "@/lib/db/stocktake-sessions";
import { StocktakeSessionScanForm } from "./scan-form";

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

function formatDateTime(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function StocktakeSessionPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const { sessionId } = await params;
  const stocktakeSession = await getStocktakeSessionDetail(sessionId, context.clinicId);

  if (!stocktakeSession) {
    notFound();
  }

  if (stocktakeSession.status !== "IN_PROGRESS") {
    redirect(`/stocktake/sessions/${sessionId}/history`);
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <AppNav current="stocktake" />

        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">棚卸セッション入力</h1>
            <p className="mt-2 text-sm text-muted">
              1商品ずつ実在庫を入力します。入力内容は明細ごとに保存され、確定までは在庫数を変更しません。
            </p>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href="/stocktake/sessions">
            セッション一覧へ戻る
          </a>
        </header>


        <section className="grid gap-3 rounded border border-line bg-white p-4 text-sm shadow-panel md:grid-cols-4">
          <div>
            <p className="text-muted">状態</p>
            <p className="mt-1 font-semibold">{getStocktakeSessionStatusLabel(stocktakeSession.status)}</p>
          </div>
          <div>
            <p className="text-muted">開始</p>
            <p className="mt-1 font-semibold">{formatDateTime(stocktakeSession.startedAt)}</p>
          </div>
          <div>
            <p className="text-muted">開始者</p>
            <p className="mt-1 font-semibold">{stocktakeSession.startedByUserName}</p>
          </div>
          <div>
            <p className="text-muted">進捗</p>
            <p className="mt-1 font-semibold">
              入力済み {stocktakeSession.countedCount} / 未入力 {stocktakeSession.pendingCount} / スキップ{" "}
              {stocktakeSession.skippedCount}
            </p>
          </div>
        </section>

        <StocktakeSessionScanForm session={stocktakeSession} />
      </div>
    </main>
  );
}
