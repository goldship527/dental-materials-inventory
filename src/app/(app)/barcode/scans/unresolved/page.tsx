import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/domain/app-nav";
import {
  type BarcodeScanLogRow,
  getBarcodeScanMatchTypeLabel,
  getBarcodeScanResolveStatusClass,
  getBarcodeScanResolveStatusLabel,
  getUnresolvedBarcodeScanLogRows,
} from "@/lib/db/barcode-scan-logs";
import { requireActiveClinic } from "@/lib/db/clinic";
import { UnresolvedScanActions } from "./unresolved-scan-actions";

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function getMatchBadgeClass(matchType: string) {
  if (matchType === "PRODUCT_MULTI") {
    return "bg-orange-50 text-orange-700";
  }

  if (matchType === "SAMPLE") {
    return "bg-yellow-50 text-warning";
  }

  return "bg-gray-100 text-muted";
}

function getAttachBarcode(log: BarcodeScanLogRow) {
  return log.extractedJan13 ?? log.extractedBarcode ?? log.sampleJanCode ?? log.extractedGtin ?? log.rawInput;
}

function getResolutionHint(log: BarcodeScanLogRow) {
  if (log.matchType === "SAMPLE") {
    return "取込サンプルに一致しています。";
  }

  if (log.matchType === "PRODUCT_MULTI") {
    return "商品候補が複数あります。";
  }

  return "商品マスタに一致していません。";
}

export default async function UnresolvedBarcodeScansPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const context = await requireActiveClinic();
  const logs = await getUnresolvedBarcodeScanLogRows(context.clinicId);

  return (
    <main className="min-h-screen bg-surface px-6 py-8 text-ink">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <AppNav current="barcode" />

        <header className="flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-accent">{context.clinicName}</p>
            <h1 className="mt-2 text-3xl font-semibold">未対応バーコード整理</h1>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <a className="text-accent hover:underline" href="/barcode/scans">
              読み取り履歴へ
            </a>
            <a className="text-accent hover:underline" href="/barcode">
              バーコード検索へ
            </a>
          </div>
        </header>


        <section className="grid gap-3 rounded border border-line bg-white px-4 py-3 text-sm text-muted shadow-panel md:grid-cols-[1fr_auto] md:items-center">
          <p>
            未対応 {logs.length} 件
          </p>
          <a className="font-semibold text-accent hover:underline" href="/products">
            商品マスタを見る
          </a>
        </section>

        <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-4 py-3">保存日時</th>
                  <th className="border-b border-line px-4 py-3">判定</th>
                  <th className="border-b border-line px-4 py-3">読み取り値</th>
                  <th className="border-b border-line px-4 py-3">抽出コード</th>
                  <th className="border-b border-line px-4 py-3">対象情報</th>
                  <th className="border-b border-line px-4 py-3">整理</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map((log) => {
                    const attachBarcode = getAttachBarcode(log);
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
                          <p className="mt-1 text-xs">操作者: {log.userName}</p>
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
                          </div>
                        </td>
                        <td className="border-b border-line px-4 py-3">
                          <p className="text-sm text-muted">{getResolutionHint(log)}</p>
                          {log.matchType === "SAMPLE" ? (
                            <div className="mt-2 grid gap-1 text-xs text-muted">
                              <p className="font-semibold text-ink">{log.sampleProductName ?? "サンプル名未設定"}</p>
                              <p>{log.sampleManufacturer ?? "メーカー未設定"}</p>
                              <p>JAN {log.sampleJanCode ?? "-"}</p>
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
                        <td className="border-b border-line px-4 py-3">
                          <div className="grid min-w-[180px] gap-2">
                            <a
                              className="rounded border border-line bg-white px-3 py-2 text-center text-xs font-semibold text-muted transition hover:border-accent hover:text-accent"
                              href={`/products?attachBarcode=${encodeURIComponent(attachBarcode)}`}
                            >
                              紐づける
                            </a>
                            <UnresolvedScanActions logId={log.id} matchType={log.matchType} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted" colSpan={6}>
                      未対応の読み取り履歴はありません。
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
