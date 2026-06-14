import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getActiveStaffOperatorOptionsForClinic } from "@/lib/db/staff-operators";
import { BarcodeBatchClient } from "../batch/barcode-batch-client";

export default async function BarcodeOutPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const staffOperators = await getActiveStaffOperatorOptionsForClinic({
    organizationId: context.organizationId,
    clinicId: context.clinicId,
  });

  return (
    <main className="min-h-screen bg-surface px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <AppNav current="barcodeOut" />

        <header className="flex flex-col gap-2 border-b border-line pb-4">
          <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
          <div>
            <h1 className="text-3xl font-semibold">出庫する</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              商品バーコードを連続で読み取り、出庫リストにためてから一括確定します。
            </p>
          </div>
        </header>

        <BarcodeBatchClient
          clinicId={context.clinicId}
          initialMode="OUT"
          fixedMode="OUT"
          staffOperators={staffOperators}
        />
      </div>
    </main>
  );
}
