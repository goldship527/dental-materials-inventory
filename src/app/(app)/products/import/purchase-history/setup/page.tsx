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
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppNav current="products" />

        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">購入履歴登録商品の一括整備</h1>
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
        </header>

        <PurchaseHistorySetupForm products={products} categories={categories} />
      </div>
    </main>
  );
}
