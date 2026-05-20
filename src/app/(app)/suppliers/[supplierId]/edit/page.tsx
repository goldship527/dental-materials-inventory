import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
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

  const context = await requireActiveClinic();
  const { supplierId } = await params;
  const supplier = await getSupplierDetail(supplierId, context.organizationId, context.clinicId);

  if (!supplier) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">発注先マスタ編集</h1>
            <p className="mt-2 text-sm text-muted">
              発注候補や商品マスタに表示される発注先名を編集します。
            </p>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href={`/suppliers/${supplier.id}`}>
            発注先詳細へ戻る
          </a>
        </header>

        <AppNav current="suppliers" />

        <SupplierEditForm supplier={supplier} />
      </div>
    </main>
  );
}
