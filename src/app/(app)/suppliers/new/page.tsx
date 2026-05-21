import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { requireActiveClinic } from "@/lib/db/clinic";
import { SupplierCreateForm } from "./supplier-create-form";

export default async function SupplierNewPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  await requireAdminUser({
    unauthorizedRedirectTo: "/suppliers",
  });

  const context = await requireActiveClinic();

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <AppNav current="suppliers" />

        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">発注先マスタ新規作成</h1>
          </div>
          <a className="text-sm font-semibold text-accent hover:underline" href="/suppliers">
            発注先マスタへ戻る
          </a>
        </header>

        <SupplierCreateForm />
      </div>
    </main>
  );
}
