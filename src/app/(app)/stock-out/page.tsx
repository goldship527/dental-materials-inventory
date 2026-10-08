import { PageShell } from "@/components/ui/page-shell";
import { requireActiveClinic } from "@/lib/db/clinic";
import { prisma } from "@/lib/db/prisma";
import { getActiveStaffOperatorOptionsForClinic } from "@/lib/db/staff-operators";
import { getCardStockRows } from "@/lib/db/card-stock";
import { StockOutCatalog } from "./stock-out-catalog";

export default async function StockOutPage() {
  const context = await requireActiveClinic();
  const [cards, staffOperators] = await Promise.all([
    getCardStockRows(prisma, context),
    getActiveStaffOperatorOptionsForClinic({organizationId: context.organizationId, clinicId: context.clinicId}),
  ]);
  return (
    <PageShell current="barcodeOut" mainClassName="px-3 pt-3 pb-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header>
          <h1 className="text-xl font-semibold">出庫する</h1>
        </header>
        <StockOutCatalog key={context.clinicId} cards={cards} clinicId={context.clinicId} staffOperators={staffOperators} />
      </div>
    </PageShell>
  );
}
