import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { requireActiveClinic } from "@/lib/db/clinic";
import { PurchaseHistoryImportForm } from "./purchase-history-import-form";

export default async function PurchaseHistoryImportPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  await requireAdminUser({
    unauthorizedRedirectTo: "/products",
  });

  const context = await requireActiveClinic();

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppNav current="products" />

        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">ディーラー購入履歴インポート</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              ディーラーから受け取った購入履歴をもとに、商品マスタ候補を確認します。
              まずは既存商品との照合とプレビューに絞り、在庫数や商品マスタは変更しません。
            </p>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href="/products/import">
            商品マスタ一括取り込みへ戻る
          </a>
        </header>

        <PurchaseHistoryImportForm />
      </div>
    </main>
  );
}
