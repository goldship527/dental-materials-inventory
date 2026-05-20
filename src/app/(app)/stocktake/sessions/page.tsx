import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import {
  getStocktakeSessionIndex,
  getStocktakeSessionStatusLabel,
  type StocktakeSessionListRow,
} from "@/lib/db/stocktake-sessions";

function formatDateTime(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function ProgressText({ row }: { row: StocktakeSessionListRow }) {
  return (
    <span>
      入力済み {row.countedCount} / 未入力 {row.pendingCount} / スキップ {row.skippedCount}
    </span>
  );
}

function SessionRow({ row, isHistory = false }: { row: StocktakeSessionListRow; isHistory?: boolean }) {
  const href = isHistory ? `/stocktake/sessions/${row.id}/history` : `/stocktake/sessions/${row.id}`;

  return (
    <tr className="align-top">
      <td className="border-b border-line px-4 py-3">
        <a className="font-semibold text-accent hover:underline" href={href}>
          {getStocktakeSessionStatusLabel(row.status)}
        </a>
        {row.memo ? <p className="mt-1 text-xs text-muted">{row.memo}</p> : null}
      </td>
      <td className="border-b border-line px-4 py-3">{formatDateTime(row.startedAt)}</td>
      <td className="border-b border-line px-4 py-3">{row.startedByUserName}</td>
      <td className="border-b border-line px-4 py-3 text-right">{row.itemCount}</td>
      <td className="border-b border-line px-4 py-3 text-sm text-muted">
        <ProgressText row={row} />
      </td>
      <td className="border-b border-line px-4 py-3">{formatDateTime(row.updatedAt)}</td>
      <td className="border-b border-line px-4 py-3 text-right">
        <a
          className="inline-flex h-9 items-center rounded bg-ink px-4 text-xs font-semibold text-white transition hover:bg-gray-700"
          href={href}
        >
          {isHistory ? "詳細" : "入力"}
        </a>
      </td>
    </tr>
  );
}

export default async function StocktakeSessionsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const { inProgressSession, historySessions } = await getStocktakeSessionIndex(context.clinicId);

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">棚卸セッション</h1>
            <p className="mt-2 text-sm text-muted">
              棚卸を途中保存しながら進めます。入力中のセッションはクリニックごとに1件です。
            </p>
          </div>
          <a
            className="inline-flex h-11 items-center justify-center rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
            href="/stocktake/sessions/new"
          >
            新規開始
          </a>
        </header>

        <AppNav current="stocktake" />

        <section className="rounded border border-line bg-white shadow-panel">
          <div className="flex flex-col gap-2 border-b border-line px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">進行中</h2>
              <p className="mt-1 text-sm text-muted">既に入力中の棚卸がある場合は、新規開始せずこのセッションに戻ります。</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">状態</th>
                  <th className="border-b border-line px-4 py-3">開始</th>
                  <th className="border-b border-line px-4 py-3">開始者</th>
                  <th className="border-b border-line px-4 py-3 text-right">商品数</th>
                  <th className="border-b border-line px-4 py-3">進捗</th>
                  <th className="border-b border-line px-4 py-3">最終更新</th>
                  <th className="border-b border-line px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {inProgressSession ? (
                  <SessionRow row={inProgressSession} />
                ) : (
                  <tr>
                    <td className="px-4 py-10 text-center text-muted" colSpan={7}>
                      入力中の棚卸セッションはありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded border border-line bg-white shadow-panel">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-lg font-semibold">履歴</h2>
            <p className="mt-1 text-sm text-muted">確定済み・破棄済みのセッションを新しい順に最大50件表示します。</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">状態</th>
                  <th className="border-b border-line px-4 py-3">開始</th>
                  <th className="border-b border-line px-4 py-3">開始者</th>
                  <th className="border-b border-line px-4 py-3 text-right">商品数</th>
                  <th className="border-b border-line px-4 py-3">内訳</th>
                  <th className="border-b border-line px-4 py-3">最終更新</th>
                  <th className="border-b border-line px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {historySessions.length > 0 ? (
                  historySessions.map((row) => <SessionRow key={row.id} row={row} isHistory />)
                ) : (
                  <tr>
                    <td className="px-4 py-10 text-center text-muted" colSpan={7}>
                      履歴はまだありません。
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
