import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import { createBarcodeScanLogAction } from "@/lib/actions/barcode-scan-logs";
import { createTestProductFromSampleAction } from "@/lib/actions/imports";
import { analyzeBarcodeInput } from "@/lib/barcode/gs1";
import { searchProductsByBarcode } from "@/lib/db/barcodes";
import { requireActiveClinic } from "@/lib/db/clinic";
import { findMedicalDeviceSampleRecordsByJan } from "@/lib/imports/medical-device-samples";
import { BarcodeSearchForm } from "./barcode-search-form";

type PageProps = {
  searchParams?: Promise<{
    barcode?: string;
    scanLog?: string;
  }>;
};

function getStockStatusLabel(quantity: number, minStock: number) {
  if (quantity === 0) {
    return {
      label: "在庫なし",
      className: "bg-red-50 text-danger",
    };
  }

  if (quantity < minStock) {
    return {
      label: "不足中",
      className: "bg-yellow-50 text-warning",
    };
  }

  if (quantity === minStock) {
    return {
      label: "最低在庫ちょうど",
      className: "bg-yellow-50 text-warning",
    };
  }

  return {
    label: "在庫あり",
    className: "bg-emerald-50 text-accent",
  };
}

function formatGs1ExpiryDate(value: Date | null, fallback: string | null) {
  if (!value) {
    return fallback;
  }

  const year = String(value.getFullYear()).padStart(4, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}/${month}/${day}`;
}

export default async function BarcodePage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const barcode = params.barcode?.trim() ?? "";
  const scanLogStatus = params.scanLog ?? "";
  const barcodeAnalysis = analyzeBarcodeInput(barcode);
  const results = barcode ? await searchProductsByBarcode(context.clinicId, barcode) : [];
  const sampleMatches = barcodeAnalysis.extractedJan13
    ? await findMedicalDeviceSampleRecordsByJan(barcodeAnalysis.extractedJan13, 5)
    : [];
  const hasSearched = barcode.length > 0;
  const attachBarcodeHref = `/products?attachBarcode=${encodeURIComponent(barcodeAnalysis.preferredAttachBarcode)}`;
  const expiryDateLabel = formatGs1ExpiryDate(barcodeAnalysis.expiryDate, barcodeAnalysis.expiryDateText);
  const hasAnalysisBadges = Boolean(
    barcodeAnalysis.extractedBarcode ||
      barcodeAnalysis.scannedAtText ||
      expiryDateLabel ||
      barcodeAnalysis.lotNumber ||
      barcodeAnalysis.serialNumber,
  );

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">バーコード検索</h1>
            <p className="mt-2 text-sm text-muted">
              スキャナーや手入力でJANコード・登録済みバーコードから商品を探します。
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <a className="text-accent hover:underline" href="/barcode/scans/unresolved">
              未対応を整理
            </a>
            <a className="text-accent hover:underline" href="/barcode/scans">
              読取履歴を見る
            </a>
            <a className="text-accent hover:underline" href="/home">
              ホームへ戻る
            </a>
          </div>
        </header>

        <AppNav current="barcode" />

        <BarcodeSearchForm defaultBarcode={barcode} />

        {scanLogStatus === "saved" ? (
          <section className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-accent shadow-panel">
            この読み取りを履歴に保存しました。
          </section>
        ) : null}

        {!hasSearched ? (
          <section className="rounded border border-line bg-white p-5 text-sm text-muted shadow-panel">
            バーコードを読み取ると、該当する商品候補がここに表示されます。まずは商品確認用として使い、在庫数は変更しません。
          </section>
        ) : null}

        {hasSearched ? (
          <section className="rounded border border-line bg-white shadow-panel">
            <div className="border-b border-line px-4 py-3 text-sm text-muted">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                <div>
                  検索値: <span className="font-mono text-ink">{barcode}</span> / 該当 {results.length} 件
                </div>
                <form action={createBarcodeScanLogAction}>
                  <input type="hidden" name="rawInput" value={barcode} />
                  <button
                    type="submit"
                    className="rounded border border-accent bg-white px-4 py-2 text-sm font-semibold text-accent transition hover:bg-teal-50"
                  >
                    この読み取りを履歴に保存
                  </button>
                </form>
              </div>
              {hasAnalysisBadges ? (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {barcodeAnalysis.extractedGtin ? (
                    <span className="rounded bg-teal-50 px-2 py-1 font-semibold text-accent">
                      GS1の商品コード: <span className="font-mono">{barcodeAnalysis.extractedGtin}</span>
                    </span>
                  ) : null}
                  {barcodeAnalysis.extractedJan13 ? (
                    <span className="rounded bg-gray-50 px-2 py-1 font-semibold text-muted">
                      抽出JAN: <span className="font-mono">{barcodeAnalysis.extractedJan13}</span>
                    </span>
                  ) : null}
                  {barcodeAnalysis.scannedAtText ? (
                    <span className="rounded bg-gray-50 px-2 py-1 font-semibold text-muted">
                      読み取り日時: <span className="font-mono">{barcodeAnalysis.scannedAtText}</span>
                    </span>
                  ) : null}
                  {expiryDateLabel ? (
                    <span className="rounded bg-gray-50 px-2 py-1 font-semibold text-muted">
                      有効期限: <span className="font-mono">{expiryDateLabel}</span>
                    </span>
                  ) : null}
                  {barcodeAnalysis.lotNumber ? (
                    <span className="rounded bg-gray-50 px-2 py-1 font-semibold text-muted">
                      ロット: <span className="font-mono">{barcodeAnalysis.lotNumber}</span>
                    </span>
                  ) : null}
                  {barcodeAnalysis.serialNumber ? (
                    <span className="rounded bg-gray-50 px-2 py-1 font-semibold text-muted">
                      シリアル: <span className="font-mono">{barcodeAnalysis.serialNumber}</span>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {results.length > 0 ? (
              <div className="grid gap-0 divide-y divide-line">
                {results.map((result) => {
                  const stockStatus = getStockStatusLabel(result.quantity, result.minStock);
                  const shortageCount = Math.max(0, result.minStock - result.quantity);

                  return (
                    <article key={result.productId} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            className="text-xl font-semibold text-accent hover:underline"
                            href={`/products/${result.productId}`}
                          >
                            {result.productName}
                          </a>
                          <span className={`rounded px-3 py-1 text-xs font-semibold ${stockStatus.className}`}>
                            {stockStatus.label}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted">
                          {result.productCode ?? "商品コード未設定"} / {result.category ?? "カテゴリ未設定"} /{" "}
                          {result.manufacturer ?? "メーカー未設定"}
                        </p>
                        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                          <div className="rounded border border-line px-3 py-2">
                            <p className="text-xs font-semibold text-muted">現在庫</p>
                            <p className="mt-1 text-2xl font-semibold">{result.quantity}</p>
                          </div>
                          <div className="rounded border border-line px-3 py-2">
                            <p className="text-xs font-semibold text-muted">最低在庫</p>
                            <p className="mt-1 text-2xl font-semibold">{result.minStock}</p>
                          </div>
                          <div className="rounded border border-line px-3 py-2">
                            <p className="text-xs font-semibold text-muted">不足数</p>
                            <p className={shortageCount > 0 ? "mt-1 text-2xl font-semibold text-danger" : "mt-1 text-2xl font-semibold"}>
                              {shortageCount}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-2 text-sm text-muted">
                          <p>保管場所: {result.location ?? "-"}</p>
                          <p>
                            主発注先:{" "}
                            {result.supplierId && result.supplierName ? (
                              <a className="font-semibold text-accent hover:underline" href={`/suppliers/${result.supplierId}`}>
                                {result.supplierName}
                              </a>
                            ) : (
                              "-"
                            )}
                          </p>
                          <p>規格・単位: {[result.specification, result.orderUnit].filter(Boolean).join(" / ") || "-"}</p>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {result.matchedBarcodes.map((match) => (
                            <span
                              key={`${result.productId}-${match.source}-${match.barcode}`}
                              className="rounded bg-gray-50 px-3 py-1 font-mono text-xs font-semibold text-muted"
                            >
                              {match.barcode} / {match.barcodeType}
                              {match.unitLabel ? ` / ${match.unitLabel}` : ""}
                              {match.isPrimary ? " / 代表" : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <a
                          className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                          href={`/products/${result.productId}`}
                        >
                          商品詳細へ
                        </a>
                        <a
                          className="rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                          href={`/inventory?q=${encodeURIComponent(result.productName)}`}
                        >
                          在庫一覧で確認
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : sampleMatches.length > 0 ? (
              <div className="grid gap-4 px-4 py-6">
                <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-muted">
                  <p className="font-semibold text-ink">商品マスタには未登録ですが、取込サンプルに一致しました。</p>
                  <p className="mt-1">
                    読み取り日時は確認用として表示しています。現時点では在庫数や履歴には保存していません。
                  </p>
                </div>
                <div className="grid gap-3">
                  {sampleMatches.map((sample) => (
                    <article
                      key={`${sample.sourceFile}-${sample.sourceRow}-${sample.janCode}`}
                      className="grid gap-3 rounded border border-line p-4 md:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-semibold text-ink">{sample.productName}</p>
                          {sample.isDuplicateJan ? (
                            <span className="rounded bg-yellow-100 px-2 py-1 text-xs font-semibold text-warning">重複JAN</span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-muted">
                          {sample.manufacturer || "メーカー未設定"} / {sample.genericName || "一般的名称未設定"} / 包装単位{" "}
                          {sample.packageUnit || "-"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                          <span className="rounded bg-gray-50 px-2 py-1 font-mono font-semibold">{sample.janCode}</span>
                          <span className="rounded bg-gray-50 px-2 py-1">JMDN {sample.jmdnCode || "-"}</span>
                          <span className="rounded bg-gray-50 px-2 py-1">
                            {sample.sourceFile} / 行 {sample.sourceRow}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <a
                          className="rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                          href={`/imports/medical-devices?q=${encodeURIComponent(sample.janCode)}`}
                        >
                          取込確認で見る
                        </a>
                        <form action={createTestProductFromSampleAction}>
                          <input type="hidden" name="janCode" value={sample.janCode} />
                          <input type="hidden" name="sourceFile" value={sample.sourceFile} />
                          <input type="hidden" name="sourceRow" value={sample.sourceRow} />
                          <button
                            type="submit"
                            className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                          >
                            テスト商品として在庫に追加
                          </button>
                        </form>
                        <a
                          className="rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                          href={attachBarcodeHref}
                        >
                          既存商品へ紐づける
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-4 px-4 py-12 text-center text-sm text-muted">
                <p>
                  該当する商品は見つかりませんでした。既存商品にこのバーコードを紐づける場合は、商品を選んでから登録します。
                </p>
                <div>
                  <a
                    className="inline-flex rounded bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
                    href={attachBarcodeHref}
                  >
                    商品を探して紐づける
                  </a>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
