import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Ean13Barcode } from "@/components/domain/ean13-barcode";
import { AppNav } from "@/components/domain/app-nav";
import { requireAdminUser } from "@/lib/auth/admin";
import { requireActiveClinic } from "@/lib/db/clinic";
import { filterMedicalDeviceSampleRecords, readMedicalDeviceSampleCache } from "@/lib/imports/medical-device-samples";
import { BarcodePrintButton } from "../barcode-print-button";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
    sourceFile?: string;
    duplicateOnly?: string;
  }>;
};

function buildBackHref(q: string, sourceFile: string, duplicateOnly: boolean) {
  const params = new URLSearchParams();

  if (q) {
    params.set("q", q);
  }

  if (sourceFile) {
    params.set("sourceFile", sourceFile);
  }

  if (duplicateOnly) {
    params.set("duplicateOnly", "1");
  }

  const query = params.toString();
  return `/imports/medical-devices${query ? `?${query}` : ""}`;
}

export default async function MedicalDeviceBarcodeLabelsPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  await requireAdminUser({
    unauthorizedRedirectTo: "/home",
  });
  const context = await requireActiveClinic();
  const cacheResult = await readMedicalDeviceSampleCache();
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const sourceFile = params.sourceFile?.trim() ?? "";
  const duplicateOnly = params.duplicateOnly === "1";

  if (cacheResult.status === "missing") {
    redirect("/imports/medical-devices");
  }

  const { filtered, visible } = filterMedicalDeviceSampleRecords(cacheResult.cache, {
    q,
    sourceFile,
    duplicateOnly,
    limit: 60,
  });

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
          .barcode-label {
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: none;
          }
        }
      `}</style>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 print:max-w-none print:gap-0">
        <div className="print:hidden">
          <AppNav current="imports" />
        </div>

        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between print:hidden">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">バーコードテスト印刷</h1>
            <p className="mt-2 text-sm text-muted">
              画面表示または印刷したJANバーコードをスキャナーで読み取り、`/barcode` の検索確認に使います。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              className="rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              href={buildBackHref(q, sourceFile, duplicateOnly)}
            >
              プレビューへ戻る
            </a>
            <BarcodePrintButton />
          </div>
        </header>


        <section className="rounded border border-line bg-white p-4 text-sm text-muted shadow-panel print:hidden">
          <p>
            条件一致 {filtered.length.toLocaleString()} 件のうち、先頭 {visible.length.toLocaleString()} 件を表示しています。
            レーザー式スキャナーで画面を読めない場合は、このページを紙に印刷して確認してください。
          </p>
        </section>

        <section className="label-grid grid gap-4 md:grid-cols-2">
          {visible.map((record) => (
            <article
              key={`${record.sourceFile}-${record.sourceRow}-${record.janCode}`}
              className="barcode-label rounded border border-line bg-white p-4 shadow-panel"
            >
              <div className="flex flex-col items-center gap-2">
                <Ean13Barcode value={record.janCode} height={70} moduleWidth={2} />
              </div>
              <div className="mt-3 grid gap-1 text-xs">
                <p className="line-clamp-2 font-semibold text-ink">{record.productName}</p>
                <p className="text-muted">{record.manufacturer || "メーカー未設定"}</p>
                <p className="text-muted">
                  {record.genericName || "一般的名称未設定"} / 包装単位 {record.packageUnit || "-"}
                </p>
              </div>
            </article>
          ))}
        </section>

        {visible.length === 0 ? <p className="rounded bg-white p-6 text-center text-sm text-muted">表示できるラベルがありません。</p> : null}
      </div>
    </main>
  );
}
