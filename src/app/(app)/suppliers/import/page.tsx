import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { requireActiveClinic } from "@/lib/db/clinic";
import { SupplierImportForm } from "./supplier-import-form";

export default async function SupplierImportPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  await requireAdminUser({
    unauthorizedRedirectTo: "/suppliers",
  });

  const context = await requireActiveClinic();

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppNav current="suppliers" />

        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">発注先マスタ一括取り込み</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              CSVまたはExcel貼り付けで、発注先をまとめて新規追加します。同じ名前の発注先はスキップします。
            </p>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href="/suppliers">
            発注先マスタ一覧へ戻る
          </a>
        </header>

        <SupplierImportForm />
      </div>
    </main>
  );
}
