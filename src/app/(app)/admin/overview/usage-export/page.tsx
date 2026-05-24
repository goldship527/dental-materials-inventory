import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { getDefaultAdminUsageExportDateRange } from "@/lib/db/admin-usage-export";

export default async function AdminUsageExportPage() {
  await requireAdminUser();
  const defaults = getDefaultAdminUsageExportDateRange();

  return (
    <>
      <AppNav current="overview" />
      <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">本部ダッシュボード / CSV出力</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">使用個数CSV出力</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              指定期間の出庫数を、法人合計とクリニック別の商品単位でCSV出力します。
            </p>
          </div>
          <a
            className="inline-flex h-11 shrink-0 items-center justify-center rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            href="/admin/overview"
          >
            本部ダッシュボードへ戻る
          </a>
        </header>

        <section className="rounded border border-line bg-white p-5 shadow-panel">
          <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" action="/admin/overview/usage-export/download">
            <label className="grid gap-2 text-sm font-semibold text-muted">
              開始日
              <input
                className="h-11 rounded border border-line bg-white px-3 text-base font-normal text-ink outline-none transition focus:border-accent"
                defaultValue={defaults.startDateText}
                name="startDate"
                required
                type="date"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-muted">
              終了日
              <input
                className="h-11 rounded border border-line bg-white px-3 text-base font-normal text-ink outline-none transition focus:border-accent"
                defaultValue={defaults.endDateText}
                name="endDate"
                required
                type="date"
              />
            </label>
            <button
              className="h-11 self-end rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800"
              type="submit"
            >
              CSVを出力
            </button>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <h2 className="text-lg font-semibold text-ink">出力内容</h2>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted">
              <li>法人合計とクリニック別を同じCSVに出力します。</li>
              <li>商品名、商品コード、JAN、カテゴリ、メーカーを含めます。</li>
              <li>出庫数合計、出庫回数、最終出庫日時を含めます。</li>
            </ul>
          </div>
          <div className="rounded border border-line bg-white p-5 shadow-panel">
            <h2 className="text-lg font-semibold text-ink">集計ルール</h2>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted">
              <li>`movementType = OUT` の履歴を使用個数として集計します。</li>
              <li>期間は最大366日までです。</li>
              <li>在庫数や履歴は変更しません。</li>
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
