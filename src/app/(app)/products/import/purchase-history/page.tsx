import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/ui/page-shell";
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
    <PageShell current="products" mainClassName="px-3 pt-3 pb-6 lg:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">

        <PageHeader title={"ディーラー購入履歴インポート"}>
          <div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              ディーラーから受け取った購入履歴をもとに、商品マスタ候補を確認します。
              まずは既存商品との照合とプレビューに絞り、在庫数や商品マスタは変更しません。
            </p>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href="/products/import">
            商品マスタ一括取り込みへ戻る
          </a>
        </PageHeader>

        <PurchaseHistoryImportForm />
      </div>
    </PageShell>
  );
}
