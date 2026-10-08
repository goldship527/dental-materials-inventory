import { PageHeader } from "@/components/ui/page-header";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/ui/page-shell";
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
    timeZone: "Asia/Tokyo",
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
    <PageShell current="stocktake" mainClassName="pt-3 pb-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">

        <PageHeader title={"棚卸セッション入力"}>
          <div>

            <p className="mt-2 text-sm text-muted">
              1商品ずつ実在庫を入力します。入力内容は明細ごとに保存され、確定までは在庫数を変更しません。
            </p>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href="/stocktake/sessions">
            セッション一覧へ戻る
          </a>
        </PageHeader>


        <section className="grid gap-3 rounded border border-line bg-panel p-4 text-sm shadow-sheet md:grid-cols-4">
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
    </PageShell>
  );
}
