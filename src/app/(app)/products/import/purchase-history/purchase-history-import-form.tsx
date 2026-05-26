"use client";

import { useActionState, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  confirmPurchaseHistoryImportAction,
  previewPurchaseHistoryImportAction,
  type PurchaseHistoryImportActionState,
  type PurchaseHistoryReviewDecision,
} from "@/lib/actions/purchase-history-import";
import type {
  PurchaseHistoryImportSourceType,
  PurchaseHistoryMatchReason,
  PurchaseHistoryMatchStatus,
} from "@/lib/imports/purchase-history-import";

const initialState: PurchaseHistoryImportActionState = {};

const statusLabels: Record<PurchaseHistoryMatchStatus, string> = {
  CREATE: "登録予定",
  EXISTING: "既存一致",
  NEEDS_REVIEW: "確認必要",
  ERROR: "エラー",
};

const reasonLabels: Record<PurchaseHistoryMatchReason, string> = {
  JAN_EXACT: "JAN一致",
  BARCODE_EXACT: "追加バーコード一致",
  SUPPLIER_PRODUCT_CODE_EXACT: "発注先品番一致",
  DEALER_PRODUCT_CODE_EXACT: "ディーラー商品コード一致",
  MANUFACTURER_AND_NAME_EXACT: "メーカー名+商品名一致",
  NAME_SIMILAR: "商品名類似",
  NO_MATCH: "一致なし",
  VALIDATION_ERROR: "入力エラー",
};

const reviewDecisionLabels: Record<PurchaseHistoryReviewDecision, string> = {
  EXISTING: "今回は登録しない（既存商品として扱う）",
  CREATE: "新規商品として登録",
  EXCLUDE: "今回は除外",
};

function rowClassName(status: PurchaseHistoryMatchStatus) {
  if (status === "ERROR") {
    return "bg-red-50/60";
  }

  if (status === "NEEDS_REVIEW") {
    return "bg-orange-50/70";
  }

  if (status === "CREATE") {
    return "bg-green-50/40";
  }

  return undefined;
}

function statusClassName(status: PurchaseHistoryMatchStatus) {
  if (status === "ERROR") {
    return "text-danger";
  }

  if (status === "NEEDS_REVIEW") {
    return "text-warning";
  }

  if (status === "CREATE") {
    return "text-success";
  }

  return "text-muted";
}

function formatNumber(value: number | null) {
  return value === null ? "-" : value.toLocaleString("ja-JP");
}

function candidateLabel(
  row: NonNullable<PurchaseHistoryImportActionState["preview"]>["rows"][number],
  productNamesById: Record<string, string>,
) {
  if (row.matchedProductId) {
    return productNamesById[row.matchedProductId] ?? row.matchedProductId;
  }

  if (row.candidateProductIds.length > 0) {
    return row.candidateProductIds.map((id) => productNamesById[id] ?? id).join(" / ");
  }

  return "-";
}

function shouldShowMultipleSimilarExistingNote(
  row: NonNullable<PurchaseHistoryImportActionState["preview"]>["rows"][number],
  decision: PurchaseHistoryReviewDecision | undefined,
) {
  return (
    row.status === "NEEDS_REVIEW" &&
    row.matchReason === "NAME_SIMILAR" &&
    row.candidateProductIds.length > 1 &&
    decision === "EXISTING"
  );
}

export function PurchaseHistoryImportForm() {
  const router = useRouter();
  const [sourceText, setSourceText] = useState("");
  const [sourceType, setSourceType] = useState<PurchaseHistoryImportSourceType>("CSV");
  const [fileName, setFileName] = useState("");
  const [reviewDecisions, setReviewDecisions] = useState<Record<number, PurchaseHistoryReviewDecision>>({});
  const [previewState, previewAction, isPreviewPending] = useActionState(
    previewPurchaseHistoryImportAction,
    initialState,
  );
  const [confirmState, confirmAction, isConfirmPending] = useActionState(
    confirmPurchaseHistoryImportAction,
    initialState,
  );
  const activeState = confirmState.message ? confirmState : previewState;
  const preview = activeState.preview;
  const productNamesById = activeState.productNamesById ?? {};
  const isPreviewCurrent = activeState.sourceText === sourceText && activeState.sourceType === sourceType;
  const needsReviewRows = preview?.rows.filter((row) => row.status === "NEEDS_REVIEW") ?? [];
  const selectedReviewDecisionRows = needsReviewRows.filter((row) => reviewDecisions[row.rowNumber]).length;
  const selectedReviewCreateRows = preview?.rows.filter(
    (row) => row.status === "NEEDS_REVIEW" && reviewDecisions[row.rowNumber] === "CREATE",
  ).length ?? 0;
  const hasUnselectedReviewRows = selectedReviewDecisionRows < needsReviewRows.length;
  const canConfirm = Boolean(
    preview &&
      isPreviewCurrent &&
      sourceText.trim().length > 0 &&
      preview.summary.errorRows === 0 &&
      !hasUnselectedReviewRows &&
      preview.summary.createRows + selectedReviewCreateRows > 0,
  );
  const previewRows = useMemo(() => preview?.rows.slice(0, 100) ?? [], [preview]);

  useEffect(() => {
    if (confirmState.status === "success") {
      router.refresh();
    }
  }, [confirmState.status, router]);

  useEffect(() => {
    setReviewDecisions({});
  }, [previewState.sourceText, previewState.sourceType]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSourceType("CSV");
    setFileName(file.name);
    setReviewDecisions({});
    setSourceText(await file.text());
  }

  return (
    <section className="rounded border border-line bg-white p-5 shadow-panel">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">購入履歴をプレビュー</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            CSVファイル、またはExcelから貼り付けたTSVを読み取り、既存商品との照合結果を確認します。
            この画面では商品マスタや在庫数は変更しません。
          </p>
        </div>
        <a
          href="/products/import"
          className="inline-flex min-h-11 items-center justify-center rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
        >
          商品マスタ取り込みへ戻る
        </a>
      </div>

      <form action={previewAction} className="grid gap-5">
        <input type="hidden" name="sourceText" value={sourceText} />
        <input type="hidden" name="sourceType" value={sourceType} />
        <input type="hidden" name="fileName" value={fileName} />

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <label className="grid gap-2 text-sm font-semibold text-muted">
            CSVファイル
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            />
            <span className="text-xs font-normal text-muted">
              推奨ヘッダー: purchaseDate, dealerName, dealerProductCode, supplierProductCode, janCode, productName
            </span>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-muted">
            Excel貼り付けTSV
            <textarea
              value={sourceType === "TSV" ? sourceText : ""}
              onChange={(event) => {
                setSourceType("TSV");
                setFileName("");
                setReviewDecisions({});
                setSourceText(event.target.value);
              }}
              placeholder={"購入日\tディーラー名\tディーラー商品コード\t発注先品番\tJANコード\t商品名\tメーカー名\t規格\t購入数量\t単価\t金額"}
              className="min-h-36 rounded border border-line px-3 py-2 text-sm font-normal text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
        </div>

        <div className="rounded border border-orange-200 bg-orange-50 px-4 py-3 text-sm leading-6 text-warning">
          取り込む前に、患者名や個人情報が含まれていないか確認してください。購入金額や単価が含まれるため、必要なファイルだけを使ってください。
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPreviewPending || sourceText.trim().length === 0}
            className="rounded bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPreviewPending ? "確認中" : "プレビュー"}
          </button>
          <p className="text-sm text-muted">
            まずは内容を確認する画面です。ここでは商品マスタや在庫数は変更されません。
          </p>
        </div>
      </form>

      {activeState.message ? (
        <div
          className={
            activeState.status === "success"
              ? "mt-5 rounded border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-success"
              : "mt-5 rounded border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-danger"
          }
        >
          <p>{activeState.message}</p>
          {confirmState.status === "success" ? (
            <a className="mt-3 inline-flex rounded bg-white px-3 py-2 text-sm font-semibold text-accent transition hover:bg-teal-50" href="/products/import/purchase-history/setup">
              登録した商品の設定をまとめて整える
            </a>
          ) : null}
        </div>
      ) : null}

      {preview ? (
        <div className="mt-6 grid gap-5">
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="rounded border border-line p-3">
              <p className="text-xs text-muted">対象行</p>
              <p className="mt-1 text-2xl font-semibold">{preview.summary.totalRows}</p>
            </div>
            <div className="rounded border border-line p-3">
              <p className="text-xs text-muted">登録予定</p>
              <p className="mt-1 text-2xl font-semibold text-success">{preview.summary.createRows}</p>
            </div>
            <div className="rounded border border-line p-3">
              <p className="text-xs text-muted">既存一致</p>
              <p className="mt-1 text-2xl font-semibold">{preview.summary.existingRows}</p>
            </div>
            <div className="rounded border border-line p-3">
              <p className="text-xs text-muted">確認必要</p>
              <p className="mt-1 text-2xl font-semibold text-warning">{preview.summary.needsReviewRows}</p>
            </div>
            <div className="rounded border border-line p-3">
              <p className="text-xs text-muted">エラー</p>
              <p className="mt-1 text-2xl font-semibold text-danger">{preview.summary.errorRows}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded border border-line">
            <table className="w-full min-w-[1400px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-3 py-2">行</th>
                  <th className="border-b border-line px-3 py-2">状態</th>
                  <th className="border-b border-line px-3 py-2">照合理由</th>
                  <th className="border-b border-line px-3 py-2">商品名</th>
                  <th className="border-b border-line px-3 py-2">一致/候補</th>
                  <th className="border-b border-line px-3 py-2">今回の扱い</th>
                  <th className="border-b border-line px-3 py-2">JAN</th>
                  <th className="border-b border-line px-3 py-2">発注先品番</th>
                  <th className="border-b border-line px-3 py-2">購入回数</th>
                  <th className="border-b border-line px-3 py-2">合計数量</th>
                  <th className="border-b border-line px-3 py-2">最終購入日</th>
                  <th className="border-b border-line px-3 py-2">メッセージ</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.rowNumber} className={rowClassName(row.status)}>
                    <td className="border-b border-line px-3 py-2">{row.rowNumber}</td>
                    <td className={`border-b border-line px-3 py-2 font-semibold ${statusClassName(row.status)}`}>
                      {statusLabels[row.status]}
                    </td>
                    <td className="border-b border-line px-3 py-2">{reasonLabels[row.matchReason]}</td>
                    <td className="border-b border-line px-3 py-2">
                      <p className="font-semibold">{row.productName || "-"}</p>
                      <p className="mt-1 text-xs text-muted">{row.manufacturer ?? "-"}</p>
                    </td>
                    <td className="border-b border-line px-3 py-2">{candidateLabel(row, productNamesById)}</td>
                    <td className="border-b border-line px-3 py-2">
                      {row.status === "NEEDS_REVIEW" ? (
                        <div className="grid gap-2">
                          <select
                            value={reviewDecisions[row.rowNumber] ?? ""}
                            onChange={(event) => {
                              const decision = event.target.value;

                              if (!decision) {
                                return;
                              }

                              setReviewDecisions((current) => ({
                                ...current,
                                [row.rowNumber]: decision as PurchaseHistoryReviewDecision,
                              }));
                            }}
                            className="min-h-10 rounded border border-line bg-white px-2 py-1 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                          >
                            <option value="" disabled>
                              選択してください
                            </option>
                            {Object.entries(reviewDecisionLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          {shouldShowMultipleSimilarExistingNote(row, reviewDecisions[row.rowNumber]) ? (
                            <p className="text-xs leading-5 text-warning">
                              複数候補があるため、必要に応じて商品マスタから個別に確認してください。
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="border-b border-line px-3 py-2 font-mono text-xs">{row.janCode ?? "-"}</td>
                    <td className="border-b border-line px-3 py-2 font-mono text-xs">
                      {row.supplierProductCode ?? row.dealerProductCode ?? "-"}
                    </td>
                    <td className="border-b border-line px-3 py-2 text-right">{row.purchaseCountInFile}</td>
                    <td className="border-b border-line px-3 py-2 text-right">
                      {formatNumber(row.totalQuantityInFile)}
                    </td>
                    <td className="border-b border-line px-3 py-2">{row.latestPurchaseDateInFile ?? "-"}</td>
                    <td className="border-b border-line px-3 py-2 text-xs">
                      {[...row.errors, ...row.warnings].length > 0 ? [...row.errors, ...row.warnings].join(" / ") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.rows.length > previewRows.length ? (
            <p className="text-sm text-muted">
              プレビュー表は先頭{previewRows.length}行だけ表示しています。
            </p>
          ) : null}

          <form action={confirmAction} className="rounded border border-line bg-gray-50 p-4">
            <input type="hidden" name="sourceText" value={sourceText} />
            <input type="hidden" name="sourceType" value={sourceType} />
            <input type="hidden" name="fileName" value={fileName} />
            <input type="hidden" name="reviewDecisions" value={JSON.stringify(reviewDecisions)} />
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm leading-6 text-muted">
                <p className="font-semibold text-ink">登録予定の行と、「新規商品として登録」を選んだ確認必要行を追加します。</p>
                <p>既存商品として扱う行、除外した行、エラー行、同じ商品の重複行は登録しません。在庫数も変更しません。</p>
              </div>
              <button
                type="submit"
                disabled={!canConfirm || isConfirmPending}
                className="inline-flex min-h-11 items-center justify-center rounded bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accentDeep disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isConfirmPending ? "登録中" : "登録予定の商品を追加"}
              </button>
            </div>
            {!canConfirm ? (
              <p className="mt-3 text-sm text-muted">
                {hasUnselectedReviewRows
                  ? "確認必要行がある場合は、すべての行で今回の扱いを選択してください。未選択のままでは登録できません。"
                  : "登録するには、エラーがない状態でプレビューを作成し、登録予定または新規登録にした確認必要行が1件以上ある必要があります。"}
              </p>
            ) : null}
          </form>
        </div>
      ) : null}
    </section>
  );
}
