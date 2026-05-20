import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import {
  getBarcodeScanMatchTypeLabel,
  getBarcodeScanResolveStatusClass,
  getBarcodeScanResolveStatusLabel,
  getRecentBarcodeScanLogRows,
} from "@/lib/db/barcode-scan-logs";
import { requireActiveClinic } from "@/lib/db/clinic";

type PageProps = {
  searchParams?: Promise<{
    resolve?: string;
  }>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function getMatchBadgeClass(matchType: string) {
  if (matchType === "PRODUCT") {
    return "bg-emerald-50 text-accent";
  }

  if (matchType === "PRODUCT_MULTI") {
    return "bg-orange-50 text-orange-700";
  }

  if (matchType === "SAMPLE") {
    return "bg-yellow-50 text-warning";
  }

  return "bg-gray-100 text-muted";
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

export default async function BarcodeScansPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const params = (await searchParams) ?? {};
  const resolveStatus = params.resolve === "unresolved" ? "UNRESOLVED" : undefined;
  const logs = await getRecentBarcodeScanLogRows(context.clinicId, {
    resolveStatus,
  });

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">バーコード読み取り履歴</h1>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <a className="text-accent hover:underline" href="/barcode/scans/unresolved">
              未対応
            </a>
            <a className="text-accent hover:underline" href="/barcode">
              バーコード検索へ
            </a>
            <a className="text-accent hover:underline" href="/home">
              ホームへ戻る
            </a>
          </div>
        </header>

        <AppNav current="barcode" />

        <section className="flex flex-col gap-3 rounded border border-line bg-white px-4 py-3 text-sm text-muted shadow-panel md:flex-row md:items-center md:justify-between">
          <p>
            表示 {logs.length} 件{resolveStatus ? " / 未対応のみ" : ""}
          </p>
          <div className="flex flex-wrap gap-3 font-semibold">
            <a className={resolveStatus ? "text-accent hover:underline" : "text-muted hover:text-accent"} href="/barcode/scans?resolve=unresolved">
              未対応のみ
            </a>
            <a className={!resolveStatus ? "text-accent hover:underline" : "text-muted hover:text-accent"} href="/barcode/scans">
              すべて
            </a>
          </div>
        </section>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">保存日時</th>
                  <th className="border-b border-line px-4 py-3">読み取り日時</th>
                  <th className="border-b border-line px-4 py-3">判定</th>
                  <th className="border-b border-line px-4 py-3">読み取り値</th>
                  <th className="border-b border-line px-4 py-3">抽出コード</th>
                  <th className="border-b border-line px-4 py-3">対象</th>
                  <th className="border-b border-line px-4 py-3">操作者</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map((log) => {
                    const targetName =
                      log.productName ?? log.sampleProductName ?? (log.matchType === "PRODUCT_MULTI" ? "商品候補が複数あります" : "-");
                    const targetSubText = log.productCode
                      ? log.productCode
                      : log.sampleManufacturer
                        ? log.sampleManufacturer
                        : log.sampleJanCode
                          ? `JAN ${log.sampleJanCode}`
                          : "";
                    const sampleSourceText =
                      log.sampleSourceFile || log.sampleSourceSheet || log.sampleSourceRow
                        ? [
                            log.sampleSourceFile,
                            log.sampleSourceSheet,
                            log.sampleSourceRow ? `行 ${log.sampleSourceRow}` : null,
                          ]
                            .filter(Boolean)
                            .join(" / ")
                        : null;

                    return (
                      <tr key={log.id} className="align-top">
                        <td className="border-b border-line px-4 py-3 text-muted">
                          {dateTimeFormatter.format(log.createdAt)}
                        </td>
                        <td className="border-b border-line px-4 py-3 text-muted">
                          {log.scannedAt ? dateTimeFormatter.format(log.scannedAt) : log.scannedAtText ?? "-"}
                        </td>
                        <td className="border-b border-line px-4 py-3">
                          <div className="flex flex-col gap-2">
                            <span className={`w-fit rounded px-2 py-1 text-xs font-semibold ${getMatchBadgeClass(log.matchType)}`}>
                              {getBarcodeScanMatchTypeLabel(log.matchType)}
                            </span>
                            <span className={`w-fit rounded px-2 py-1 text-xs font-semibold ${getBarcodeScanResolveStatusClass(log.resolveStatus)}`}>
                              {getBarcodeScanResolveStatusLabel(log.resolveStatus)}
                            </span>
                          </div>
                        </td>
                        <td className="border-b border-line px-4 py-3">
                          <a
                            className="break-all font-mono text-xs font-semibold text-accent hover:underline"
                            href={`/barcode?barcode=${encodeURIComponent(log.rawInput)}`}
                          >
                            {log.rawInput}
                          </a>
                        </td>
                        <td className="border-b border-line px-4 py-3 text-xs text-muted">
                          <div className="grid gap-1">
                            <span>抽出: {log.extractedBarcode ?? "-"}</span>
                            <span>JAN: {log.extractedJan13 ?? "-"}</span>
                            <span>GTIN: {log.extractedGtin ?? "-"}</span>
                            <span>有効期限: {formatGs1ExpiryDate(log.expiryDate, log.expiryDateText) ?? "-"}</span>
                            <span>ロット: {log.lotNumber ?? "-"}</span>
                            <span>シリアル: {log.serialNumber ?? "-"}</span>
                          </div>
                        </td>
                        <td className="border-b border-line px-4 py-3">
                          {log.productId ? (
                            <a className="font-semibold text-accent hover:underline" href={`/products/${log.productId}`}>
                              {targetName}
                            </a>
                          ) : (
                            <span className="font-semibold">{targetName}</span>
                          )}
                          {targetSubText ? <p className="mt-1 text-xs text-muted">{targetSubText}</p> : null}
                          {log.matchType === "SAMPLE" ? (
                            <div className="mt-2 grid gap-1 text-xs text-muted">
                              {sampleSourceText ? <p>{sampleSourceText}</p> : null}
                              {log.sampleGenericName || log.sampleJmdnCode ? (
                                <p>
                                  {log.sampleGenericName ?? "一般的名称未設定"}
                                  {log.sampleJmdnCode ? ` / JMDN ${log.sampleJmdnCode}` : ""}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </td>
                        <td className="border-b border-line px-4 py-3 text-muted">{log.userName}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted" colSpan={7}>
                      保存済みの読み取り履歴はありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
