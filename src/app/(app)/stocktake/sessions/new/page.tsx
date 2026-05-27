import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { startStocktakeSessionAction } from "@/lib/actions/stocktake-sessions";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getStocktakeStartSummary } from "@/lib/db/stocktake-sessions";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function NewStocktakeSessionPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const summary = await getStocktakeStartSummary(context.clinicId);

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <AppNav current="stocktake" />

        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">棚卸セッション開始</h1>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href="/stocktake/sessions">
            セッション一覧へ戻る
          </a>
        </header>


        {summary.inProgressSession ? (
          <section className="rounded border border-line bg-white p-5 shadow-panel">
            <h2 className="text-lg font-semibold">入力中のセッションがあります</h2>
            <p className="mt-2 text-sm text-muted">
              {formatDateTime(summary.inProgressSession.startedAt)} に開始した棚卸があります。
            </p>
            <a
              className="mt-5 inline-flex h-11 items-center rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
              href={`/stocktake/sessions/${summary.inProgressSession.id}`}
            >
              入力中の棚卸を開く
            </a>
          </section>
        ) : (
          <form action={startStocktakeSessionAction} className="rounded border border-line bg-white p-5 shadow-panel">
            <h2 className="text-lg font-semibold">新しい棚卸を開始</h2>
            <dl className="mt-5 grid gap-3 rounded bg-gray-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">対象クリニック</dt>
                <dd className="mt-1 font-semibold">{context.clinicName}</dd>
              </div>
              <div>
                <dt className="text-muted">対象商品数</dt>
                <dd className="mt-1 font-semibold">{summary.itemCount} 件</dd>
              </div>
            </dl>
            <label className="mt-5 grid gap-2 text-sm font-semibold text-muted">
              メモ
              <textarea
                name="memo"
                rows={3}
                maxLength={200}
                placeholder="任意。棚卸範囲や担当者交代時のメモなど"
                className="rounded border border-line px-3 py-2 text-sm font-normal text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </label>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={summary.itemCount === 0}
                className="h-11 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                セッションを開始
              </button>
              <a
                className="inline-flex h-11 items-center rounded border border-line px-5 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                href="/stocktake/sessions"
              >
                キャンセル
              </a>
            </div>
            {summary.itemCount === 0 ? (
              <p className="mt-3 text-sm font-semibold text-danger">対象になる在庫商品がありません。</p>
            ) : null}
          </form>
        )}
      </div>
    </main>
  );
}
