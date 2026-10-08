import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { redirect } from "next/navigation";
import { barcodeUiEnabled } from "@/lib/workflow-features";
import { Code128Barcode } from "@/components/domain/code128-barcode";
import { requireAdminUser } from "@/lib/auth/admin";
import { getStaffOperatorClinicOptions, getStaffOperatorRows } from "@/lib/db/staff-operators";
import { BarcodePrintButton } from "../../../imports/medical-devices/barcode-print-button";

type PageProps = {
  searchParams?: Promise<{
    clinicId?: string;
  }>;
};

function filterLinkClass(isSelected: boolean) {
  return isSelected
    ? "rounded border border-accent chip-selected px-3 py-2 text-sm font-semibold"
    : "rounded btn-secondary px-3 py-2 text-sm font-semibold transition";
}

export default async function StaffOperatorLabelsPage({ searchParams }: PageProps) {
  if (!barcodeUiEnabled) redirect("/admin/staff-operators");
  const context = await requireAdminUser();
  const params = (await searchParams) ?? {};
  const [operators, clinics] = await Promise.all([
    getStaffOperatorRows(context.organizationId),
    getStaffOperatorClinicOptions(context.organizationId),
  ]);
  const selectedClinic = clinics.find((clinic) => clinic.id === params.clinicId) ?? null;
  const activeOperators = operators.filter(
    (operator) =>
      operator.isActive &&
      (!selectedClinic || operator.assignedClinics.some((clinic) => clinic.id === selectedClinic.id)),
  );

  return (
    <PageShell current="staffOperators" mainClassName="px-3 pt-3 pb-6 print:bg-panel print:px-0 print:py-0" shellClassName="print:bg-panel">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        @media print {
          .label-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 5mm;
          }
          .staff-label {
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: none;
          }
        }
      `}</style>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 print:max-w-none print:gap-0">

        <PageHeader title={"担当者バーコード印刷"} className="print:hidden">
          <div>
            <p className="text-sm font-semibold text-accent">管理</p>

            <p className="mt-2 text-sm text-muted">
              必要な場合だけ、担当者の内部バーコードをCode 128形式で印刷します。クリニックごとに絞り込んで印刷できます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              className="rounded btn-secondary px-4 py-2 text-sm font-semibold transition"
              href="/admin/staff-operators"
            >
              担当者管理へ戻る
            </a>
            <BarcodePrintButton />
          </div>
        </PageHeader>

        <section className="rounded border border-line bg-panel p-4 text-sm text-muted shadow-sheet print:hidden">
          <div className="grid gap-3">
            <p>
              {selectedClinic ? `${selectedClinic.name} の` : "全クリニックの"}有効な担当者 {activeOperators.length.toLocaleString()} 件を表示しています。
              担当者バーコードには氏名や個人情報を直接入れず、`STAFF-0001` のような内部コードを使います。
            </p>
            <div className="flex flex-wrap gap-2">
              <a className={filterLinkClass(!selectedClinic)} href="/admin/staff-operators/labels">
                すべて
              </a>
              {clinics.map((clinic) => (
                <a
                  className={filterLinkClass(selectedClinic?.id === clinic.id)}
                  href={`/admin/staff-operators/labels?clinicId=${encodeURIComponent(clinic.id)}`}
                  key={clinic.id}
                >
                  {clinic.name}
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="label-grid grid gap-4 md:grid-cols-2">
          {activeOperators.map((operator) => (
            <article key={operator.id} className="staff-label rounded border border-line bg-panel p-4 shadow-sheet">
              <div className="flex flex-col items-center gap-2">
                <Code128Barcode value={operator.barcode} height={72} moduleWidth={2} />
              </div>
              <div className="mt-3 grid gap-1 text-xs">
                <p className="text-base font-semibold text-ink">{operator.displayName}</p>
                <p className="font-mono text-sm font-semibold text-ink">{operator.barcode}</p>
                <p className="text-muted">
                  {operator.assignedClinics.length > 0 ? operator.assignedClinics.map((clinic) => clinic.name).join(" / ") : "利用クリニック未設定"}
                </p>
              </div>
            </article>
          ))}
        </section>

        {activeOperators.length === 0 ? <p className="rounded bg-panel p-6 text-center text-sm text-muted">印刷できる有効な担当者がありません。</p> : null}
      </div>
    </PageShell>
  );
}
