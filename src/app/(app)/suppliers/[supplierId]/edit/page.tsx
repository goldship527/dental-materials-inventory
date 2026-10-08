import { PageHeader } from "@/components/ui/page-header";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getSupplierDetail } from "@/lib/db/suppliers";
import { SupplierEditForm } from "./supplier-edit-form";

type PageProps = {
  params: Promise<{
    supplierId: string;
  }>;
};

export default async function SupplierEditPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { supplierId } = await params;
  await requireAdminUser({
    unauthorizedRedirectTo: `/suppliers/${supplierId}`,
  });

  const context = await requireActiveClinic();
  const supplier = await getSupplierDetail(supplierId, context.organizationId, context.clinicId);

  if (!supplier) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-surface px-3 pt-3 pb-6 text-ink">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <AppNav current="suppliers" />

        <PageHeader title={"発注先マスタ編集"}>
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>

            <p className="mt-2 text-sm text-muted">
              発注候補や商品マスタに表示される発注先名を編集します。
            </p>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href={`/suppliers/${supplier.id}`}>
            発注先詳細へ戻る
          </a>
        </PageHeader>


        <SupplierEditForm supplier={supplier} />
      </div>
    </main>
  );
}
