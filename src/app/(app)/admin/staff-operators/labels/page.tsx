import { AppNav } from "@/components/domain/app-nav";
import { Code128Barcode } from "@/components/domain/code128-barcode";
import { requireAdminUser } from "@/lib/auth/admin";
import { getStaffOperatorRows } from "@/lib/db/staff-operators";
import { BarcodePrintButton } from "../../../imports/medical-devices/barcode-print-button";

export default async function StaffOperatorLabelsPage() {
  const context = await requireAdminUser();
  const operators = await getStaffOperatorRows(context.organizationId);
  const activeOperators = operators.filter((operator) => operator.isActive);

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink print:bg-white print:px-0 print:py-0">
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
        <div className="print:hidden">
          <AppNav current="staffOperators" />
        </div>

        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between print:hidden">
          <div>
            <p className="text-sm font-semibold text-accent">管理</p>
            <h1 className="mt-2 text-3xl font-semibold">担当者バーコード印刷</h1>
            <p className="mt-2 text-sm text-muted">
              登録済みの担当者バーコードをCode 128形式で印刷します。印刷したカードをスキャンすると、担当者バーコード欄に同じ文字列が入力されます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              className="rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              href="/admin/staff-operators"
            >
              担当者管理へ戻る
            </a>
            <BarcodePrintButton />
          </div>
        </header>

        <section className="rounded border border-line bg-white p-4 text-sm text-muted shadow-panel print:hidden">
          <p>
            有効な担当者 {activeOperators.length.toLocaleString()} 件を表示しています。担当者バーコードには氏名や個人情報を直接入れず、
            `STAFF-0001` のような内部コードを使います。
          </p>
        </section>

        <section className="label-grid grid gap-4 md:grid-cols-2">
          {activeOperators.map((operator) => (
            <article key={operator.id} className="staff-label rounded border border-line bg-white p-4 shadow-panel">
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

        {activeOperators.length === 0 ? <p className="rounded bg-white p-6 text-center text-sm text-muted">印刷できる有効な担当者がありません。</p> : null}
      </div>
    </main>
  );
}
