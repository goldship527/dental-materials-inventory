"use client";

import { useActionState, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  confirmProductImportAction,
  previewProductImportAction,
  type ProductImportActionState,
} from "@/lib/actions/product-import";
import type { ProductImportSourceType } from "@/lib/imports/product-master-import";

const initialState: ProductImportActionState = {};

function statusLabel(row: NonNullable<ProductImportActionState["preview"]>["rows"][number]) {
  if (row.errors.length > 0) {
    return "エラー";
  }

  if (!row.willCreate) {
    return "スキップ";
  }

  if (row.warnings.length > 0) {
    return "警告あり";
  }

  return "作成予定";
}

export function ProductImportForm() {
  const router = useRouter();
  const [sourceText, setSourceText] = useState("");
  const [sourceType, setSourceType] = useState<ProductImportSourceType>("CSV");
  const [fileName, setFileName] = useState("");
  const [previewState, previewAction, isPreviewPending] = useActionState(previewProductImportAction, initialState);
  const [confirmState, confirmAction, isConfirmPending] = useActionState(confirmProductImportAction, initialState);
  const activeState = confirmState.message ? confirmState : previewState;
  const preview = activeState.preview;
  const hasErrors = Boolean(preview && preview.summary.errorRows > 0);
  const isPreviewCurrent = activeState.sourceText === sourceText && activeState.sourceType === sourceType;
  const canConfirm = Boolean(
    preview && isPreviewCurrent && !hasErrors && sourceText.trim().length > 0 && preview.summary.createdRows > 0,
  );
  const previewRows = useMemo(() => preview?.rows.slice(0, 80) ?? [], [preview]);

  useEffect(() => {
    if (previewState.sourceText !== undefined) {
      setSourceText(previewState.sourceText);
      setSourceType(previewState.sourceType ?? "CSV");
      setFileName(previewState.fileName ?? "");
    }
  }, [previewState.fileName, previewState.sourceText, previewState.sourceType]);

  useEffect(() => {
    if (confirmState.status === "success") {
      router.refresh();
    }
  }, [confirmState.status, router]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSourceType("CSV");
    setFileName(file.name);
    setSourceText(await file.text());
  }

  return (
    <section className="rounded border border-line bg-white p-5 shadow-panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted">取り込み内容を確認してから確定します。</p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/products"
            className="rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent hover:bg-teal-50 hover:text-accent"
          >
            商品一覧へ戻る
          </a>
          <a
            href="/products/import"
            className="rounded border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent hover:bg-teal-50 hover:text-accent"
          >
            取り込みをやり直す
          </a>
        </div>
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
              ヘッダー行に「商品名」または「name」を含めてください。
            </span>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-muted">
            Excel貼り付けTSV
            <textarea
              value={sourceType === "TSV" ? sourceText : ""}
              onChange={(event) => {
                setSourceType("TSV");
                setFileName("");
                setSourceText(event.target.value);
              }}
              placeholder={"商品名\tJANコード\tカテゴリ\tメーカー\t最低在庫"}
              className="min-h-32 rounded border border-line px-3 py-2 text-sm font-normal text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
        </div>

        <div className="rounded border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-warning">
          実在患者情報、秘密情報、パスワード、APIキーは取り込みデータに入れないでください。商品行だけを扱います。
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
            対応列: 商品名、商品コード、JANコード、内部コード、カテゴリ、メーカー、規格、発注単位、発注先、発注先品番、標準価格、最低在庫、備考
          </p>
        </div>
      </form>

      {activeState.message ? (
        <p
          className={
            activeState.status === "success"
              ? "mt-5 rounded border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-success"
              : "mt-5 rounded border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-danger"
          }
        >
          {activeState.message}
        </p>
      ) : null}

      {preview ? (
        <div className="mt-6 grid gap-5">
          <div className="grid gap-3 sm:grid-cols-5">
            <div className="rounded border border-line p-3">
              <p className="text-xs text-muted">対象行</p>
              <p className="mt-1 text-2xl font-semibold">{preview.summary.totalRows}</p>
            </div>
            <div className="rounded border border-line p-3">
              <p className="text-xs text-muted">作成予定</p>
              <p className="mt-1 text-2xl font-semibold text-success">{preview.summary.createdRows}</p>
            </div>
            <div className="rounded border border-line p-3">
              <p className="text-xs text-muted">スキップ</p>
              <p className="mt-1 text-2xl font-semibold">{preview.summary.skippedRows}</p>
            </div>
            <div className="rounded border border-line p-3">
              <p className="text-xs text-muted">警告</p>
              <p className="mt-1 text-2xl font-semibold text-warning">{preview.summary.warningRows}</p>
            </div>
            <div className="rounded border border-line p-3">
              <p className="text-xs text-muted">エラー</p>
              <p className="mt-1 text-2xl font-semibold text-danger">{preview.summary.errorRows}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded border border-line">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs text-muted">
                <tr>
                  <th className="border-b border-line px-3 py-2">行</th>
                  <th className="border-b border-line px-3 py-2">状態</th>
                  <th className="border-b border-line px-3 py-2">商品名</th>
                  <th className="border-b border-line px-3 py-2">JAN</th>
                  <th className="border-b border-line px-3 py-2">カテゴリ</th>
                  <th className="border-b border-line px-3 py-2">メーカー</th>
                  <th className="border-b border-line px-3 py-2">発注先</th>
                  <th className="border-b border-line px-3 py-2">メッセージ</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.rowNumber} className={row.errors.length > 0 ? "bg-red-50/50" : row.warnings.length > 0 ? "bg-orange-50/60" : undefined}>
                    <td className="border-b border-line px-3 py-2">{row.rowNumber}</td>
                    <td className="border-b border-line px-3 py-2 font-semibold">{statusLabel(row)}</td>
                    <td className="border-b border-line px-3 py-2">{row.name || "-"}</td>
                    <td className="border-b border-line px-3 py-2 font-mono text-xs">{row.janCode ?? "-"}</td>
                    <td className="border-b border-line px-3 py-2">{row.category ?? "-"}</td>
                    <td className="border-b border-line px-3 py-2">{row.manufacturer ?? "-"}</td>
                    <td className="border-b border-line px-3 py-2">{row.primarySupplierName ?? "-"}</td>
                    <td className="border-b border-line px-3 py-2 text-xs">
                      {[...row.errors, ...row.warnings].length > 0 ? [...row.errors, ...row.warnings].join(" / ") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.rows.length > previewRows.length ? (
            <p className="text-sm text-muted">プレビュー表は先頭{previewRows.length}行だけ表示しています。</p>
          ) : null}

          <form action={confirmAction} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="sourceText" value={sourceText} />
            <input type="hidden" name="sourceType" value={sourceType} />
            <input type="hidden" name="fileName" value={fileName} />
            <button
              type="submit"
              disabled={!canConfirm || isConfirmPending}
              className="rounded bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accentDeep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConfirmPending ? "取り込み中" : "この内容で取り込む"}
            </button>
            <a
              href="/products/import"
              className="rounded border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:bg-teal-50 hover:text-accent"
            >
              取り込みをやり直す
            </a>
            <a
              href="/products"
              className="rounded border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:bg-teal-50 hover:text-accent"
            >
              商品一覧へ戻る
            </a>
            {hasErrors ? <p className="text-sm font-semibold text-danger">エラー行を修正すると確定できます。</p> : null}
          </form>
        </div>
      ) : null}
    </section>
  );
}
