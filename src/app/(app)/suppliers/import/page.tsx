import { PageHeader } from "@/components/ui/page-header";
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
    <main className="min-h-screen bg-surface px-3 pt-3 pb-6 text-ink lg:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
        <AppNav current="suppliers" />

        <PageHeader title={"発注先マスタ一括取り込み"}>
          <div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              CSVまたはExcel貼り付けで、発注先をまとめて新規追加します。同じ名前の発注先はスキップします。
            </p>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href="/suppliers">
            発注先マスタ一覧へ戻る
          </a>
        </PageHeader>

        <SupplierImportForm />
      </div>
    </main>
  );
}
