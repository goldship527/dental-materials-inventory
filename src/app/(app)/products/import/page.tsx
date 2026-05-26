import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getRecentProductImportHistories } from "@/lib/db/product-import-history";
import { ProductImportForm } from "./product-import-form";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function ProductImportPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const histories = await getRecentProductImportHistories(context.organizationId);

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppNav current="products" />

        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">商品マスタ一括取り込み</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <a className="text-sm font-semibold text-accent hover:underline" href="/products/import/purchase-history">
              購入履歴インポート
            </a>
            <a className="text-sm font-semibold text-accent hover:underline" href="/products">
              商品マスタ一覧へ戻る
            </a>
          </div>
        </header>

        <ProductImportForm />

        <section className="rounded border border-line bg-white p-5 shadow-panel">
          <h2 className="text-lg font-semibold">取り込み履歴</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-3 py-2">日時</th>
                  <th className="border-b border-line px-3 py-2">方式</th>
                  <th className="border-b border-line px-3 py-2">ファイル</th>
                  <th className="border-b border-line px-3 py-2 text-right">作成</th>
                  <th className="border-b border-line px-3 py-2 text-right">スキップ</th>
                  <th className="border-b border-line px-3 py-2 text-right">警告</th>
                  <th className="border-b border-line px-3 py-2 text-right">エラー</th>
                  <th className="border-b border-line px-3 py-2">実行者</th>
                </tr>
              </thead>
              <tbody>
                {histories.length > 0 ? (
                  histories.map((history) => (
                    <tr key={history.id}>
                      <td className="border-b border-line px-3 py-2">{dateFormatter.format(history.createdAt)}</td>
                      <td className="border-b border-line px-3 py-2">{history.sourceType}</td>
                      <td className="border-b border-line px-3 py-2">{history.fileName ?? "-"}</td>
                      <td className="border-b border-line px-3 py-2 text-right font-semibold">{history.createdRows}</td>
                      <td className="border-b border-line px-3 py-2 text-right">{history.skippedRows}</td>
                      <td className="border-b border-line px-3 py-2 text-right">{history.warningRows}</td>
                      <td className="border-b border-line px-3 py-2 text-right">{history.errorRows}</td>
                      <td className="border-b border-line px-3 py-2">{history.userName}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted" colSpan={8}>
                      まだ取り込み履歴はありません。
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
