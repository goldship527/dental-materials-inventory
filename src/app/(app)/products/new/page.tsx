import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getProductSupplierOptions } from "@/lib/db/products";
import { ProductCreateForm } from "./product-create-form";

export default async function ProductNewPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const suppliers = await getProductSupplierOptions(context.organizationId);

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">商品マスタ新規作成</h1>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href="/products">
            商品マスタ一覧へ戻る
          </a>
        </header>

        <AppNav current="products" />

        <ProductCreateForm suppliers={suppliers} />
      </div>
    </main>
  );
}
