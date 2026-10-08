import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/ui/page-shell";
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
    timeZone: "Asia/Tokyo",
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
          className="inline-flex h-9 items-center rounded btn-primary px-4 text-xs font-semibold transition"
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
    <PageShell current="stocktake" mainClassName="px-3 pt-3 pb-6 lg:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">

        <PageHeader title={"棚卸セッション"}>
          <a
            className="inline-flex h-11 items-center justify-center rounded btn-primary px-5 text-sm font-semibold transition"
            href="/stocktake/sessions/new"
          >
            新規開始
          </a>
        </PageHeader>


        <section className="rounded border border-line bg-panel shadow-sheet">
          <div className="flex flex-col gap-2 border-b border-line px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">進行中</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="bg-tint text-label text-accent">
                <tr>
                  <th className="border-b border-accent px-4 py-3">状態</th>
                  <th className="border-b border-accent px-4 py-3">開始</th>
                  <th className="border-b border-accent px-4 py-3">開始者</th>
                  <th className="border-b border-accent px-4 py-3 text-right">商品数</th>
                  <th className="border-b border-accent px-4 py-3">進捗</th>
                  <th className="border-b border-accent px-4 py-3">最終更新</th>
                  <th className="border-b border-accent px-4 py-3 text-right">操作</th>
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

        <section className="rounded border border-line bg-panel shadow-sheet">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-lg font-semibold">履歴</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="bg-tint text-label text-accent">
                <tr>
                  <th className="border-b border-accent px-4 py-3">状態</th>
                  <th className="border-b border-accent px-4 py-3">開始</th>
                  <th className="border-b border-accent px-4 py-3">開始者</th>
                  <th className="border-b border-accent px-4 py-3 text-right">商品数</th>
                  <th className="border-b border-accent px-4 py-3">内訳</th>
                  <th className="border-b border-accent px-4 py-3">最終更新</th>
                  <th className="border-b border-accent px-4 py-3 text-right">操作</th>
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
    </PageShell>
  );
}
