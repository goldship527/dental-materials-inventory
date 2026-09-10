import { AppNav } from "@/components/domain/app-nav";
import { requireActiveClinic } from "@/lib/db/clinic";
import { getOrderRequestRows } from "@/lib/db/orders";
import { getActiveStaffOperatorOptionsForClinic } from "@/lib/db/staff-operators";
import { ReceiveCatalog } from "./receive-catalog";

export default async function ReceivePage() {
  const context = await requireActiveClinic();
  const [rows, staffOperators] = await Promise.all([
    getOrderRequestRows(context.clinicId), getActiveStaffOperatorOptionsForClinic(context),
  ]);
  const pending = rows.filter(row => row.status === "ORDERED" && !row.receivedAt).map(row => ({
    id: row.id, productId: row.productId, photoUpdatedAt: row.photoUpdatedAt?.getTime() ?? null,
    name: row.name, category: row.category, supplierName: row.supplierName,
    requestedQuantity: row.requestedQuantity, orderUnit: row.orderUnit,
    orderedAt: row.orderedAt?.toISOString() ?? null,
  }));
  return <main className="min-h-screen bg-surface px-4 py-4 text-ink sm:px-6">
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <AppNav current="barcodeReceive" />
      <header><h1 className="text-2xl font-semibold">納品する</h1><p className="mt-1">届いた商品を発注日から選んで確認します。</p></header>
      <ReceiveCatalog key={context.clinicId} rows={pending} clinicId={context.clinicId} staffOperators={staffOperators} />
    </div>
  </main>;
}
