import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageShell } from "@/components/ui/page-shell";
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
    <PageShell current="suppliers" mainClassName="px-3 pt-3 pb-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">

        <PageHeader title={"発注先マスタ新規作成"}>
          <a className="text-sm font-semibold text-accent hover:underline" href="/suppliers">
            発注先マスタへ戻る
          </a>
        </PageHeader>

        <SupplierCreateForm />
      </div>
    </PageShell>
  );
}
