import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getProductCategories, getPurchaseHistorySetupProductRows } from "@/lib/db/products";
import { PurchaseHistorySetupForm } from "./purchase-history-setup-form";

export default async function PurchaseHistorySetupPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  await requireAdminUser({
    unauthorizedRedirectTo: "/products",
  });

  const context = await requireActiveClinic();
  const [products, categories] = await Promise.all([
    getPurchaseHistorySetupProductRows(context.organizationId, { clinicId: context.clinicId }),
    getProductCategories(context.organizationId),
  ]);

  return (
    <main className="min-h-screen bg-surface px-3 pt-3 pb-6 text-ink lg:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
        <AppNav current="products" />

        <PageHeader title={"購入履歴登録商品の一括整備"}>
          <div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              購入履歴から登録した商品のカテゴリと最低在庫をまとめて整えます。
              在庫数や保管場所は変更しません。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a className="text-sm font-semibold text-accent hover:underline" href="/products/import/purchase-history">
              購入履歴インポートへ戻る
            </a>
            <a className="text-sm font-semibold text-accent hover:underline" href="/products?source=purchase-history&setup=1">
              商品一覧で確認
            </a>
          </div>
        </PageHeader>

        <PurchaseHistorySetupForm products={products} categories={categories} />
      </div>
    </main>
  );
}
