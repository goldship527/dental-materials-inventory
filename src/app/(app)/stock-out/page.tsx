import { AppNav } from "@/components/domain/app-nav";
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
    <main className="min-h-screen bg-surface px-4 py-4 text-ink sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <AppNav current="barcodeOut" />
        <header>
          <h1 className="text-2xl font-semibold">出庫する</h1>
          <p className="mt-1 text-base">商品を選び、単位と数量を確認して出庫します。</p>
        </header>
        <StockOutCatalog key={context.clinicId} cards={cards} clinicId={context.clinicId} staffOperators={staffOperators} />
      </div>
    </main>
  );
}
