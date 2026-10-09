import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/ui/page-shell";
import { requireAdminUser } from "@/lib/auth/admin";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getProductSupplierOptions } from "@/lib/db/products";
import { ProductCreateForm } from "./product-create-form";

export default async function ProductNewPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  await requireAdminUser({
    unauthorizedRedirectTo: "/products",
  });
  const context = await requireActiveClinic();
  const suppliers = await getProductSupplierOptions(context.organizationId);

  return (
    <PageShell current="products" mainClassName="pt-3 pb-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">

        <PageHeader title={"商品マスタ新規作成"}>
          <a className="text-sm font-semibold text-accent hover:underline" href="/products">
            商品マスタ一覧へ戻る
          </a>
        </PageHeader>


        <ProductCreateForm suppliers={suppliers} />
      </div>
    </PageShell>
  );
}
