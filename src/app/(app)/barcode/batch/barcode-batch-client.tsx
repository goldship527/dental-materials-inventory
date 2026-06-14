"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useWorkStaffSelection } from "@/components/domain/work-staff-selection";
import {
  batchOrderReceiveAction,
  batchStockOutAction,
  resolveBatchScanAction,
  type BatchActionState,
} from "@/lib/actions/barcode-batch";
import { barcodeStockOutReasons } from "@/lib/barcode/stock-reasons";
import type { StaffOperatorOption } from "@/lib/db/staff-operators";

type BatchMode = "IN" | "OUT";
type BatchLineStatus =
  | "receivable"
  | "stock-out-ready"
  | "unknown"
  | "multiple-products"
  | "no-pending-order"
  | "multiple-pending-orders";

type BatchLine = {
  id: string;
  status: BatchLineStatus;
  barcode: string;
  productId: string | null;
  productName: string | null;
  productCode: string | null;
  currentQuantity: number | null;
  orderRequestId: string | null;
  requestedQuantity: number | null;
  supplierName: string | null;
  lotNumber: string | null;
  expiryDateText: string | null;
  quantity: number;
  message: string;
};

type BarcodeBatchClientProps = {
  clinicId: string;
  initialMode: BatchMode;
  fixedMode?: BatchMode;
  staffOperators: StaffOperatorOption[];
};

const readyStatuses = new Set<BatchLineStatus>(["receivable", "stock-out-ready"]);

function createLineId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getLineTone(status: BatchLineStatus) {
  if (readyStatuses.has(status)) {
    return "border-line bg-white";
  }

  if (status === "unknown" || status === "multiple-products") {
    return "border-warning/30 bg-yellow-50";
  }

  return "border-orange-200 bg-orange-50";
}

function clampQuantity(value: number) {
  return Math.max(1, Math.min(9999, Math.trunc(Number.isFinite(value) ? value : 1)));
}

export function BarcodeBatchClient({ clinicId, initialMode, fixedMode, staffOperators }: BarcodeBatchClientProps) {
  const [mode, setMode] = useState<BatchMode>(fixedMode ?? initialMode);
  const [barcode, setBarcode] = useState("");
  const [lines, setLines] = useState<BatchLine[]>([]);
  const [reason, setReason] = useState("使用");
  const [reasonNote, setReasonNote] = useState("");
  const [result, setResult] = useState<BatchActionState>({});
  const [scanMessage, setScanMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const autoScanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoScanBarcodeRef = useRef("");
  const { hasStaffOperators, selectedStaffOperator, selectedStaffOperatorId, selectStaffOperator } =
    useWorkStaffSelection({
      clinicId,
      staffOperators,
    });
  const isFixedMode = Boolean(fixedMode);
  const readyLines = lines.filter((line) => readyStatuses.has(line.status));
  const blockedLines = lines.length - readyLines.length;
  const invalidReceiveLines = lines.filter(
    (line) =>
      line.status === "receivable" &&
      line.requestedQuantity !== null &&
      line.quantity > line.requestedQuantity,
  );
  const invalidStockOutLines = lines.filter(
    (line) =>
      line.status === "stock-out-ready" &&
      line.currentQuantity !== null &&
      line.quantity > line.currentQuantity,
  );
  const canConfirm =
    !isPending &&
    Boolean(selectedStaffOperatorId) &&
    readyLines.length > 0 &&
    (mode === "IN" ? invalidReceiveLines.length === 0 : invalidStockOutLines.length === 0);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode, lines.length, result.status]);

  useEffect(() => {
    if (fixedMode) {
      setMode(fixedMode);
    }
  }, [fixedMode]);

  useEffect(() => {
    const nextBarcode = barcode.trim();

    if (autoScanTimerRef.current) {
      clearTimeout(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }

    if (!nextBarcode) {
      lastAutoScanBarcodeRef.current = "";
      return;
    }

    if (nextBarcode === lastAutoScanBarcodeRef.current || isPending) {
      return;
    }

    const autoScanDelayMs = /^STAFF-\d{4,}$/i.test(nextBarcode) ? 250 : 450;

    autoScanTimerRef.current = setTimeout(() => {
      lastAutoScanBarcodeRef.current = nextBarcode;
      startTransition(async () => {
        try {
          const resolution = await resolveBatchScanAction({
            mode,
            barcode: nextBarcode,
          });

          addResolvedLine(resolution);
          setBarcode("");
        } catch (error) {
          setScanMessage(error instanceof Error ? error.message : "読み取りを処理できませんでした。");
        }
      });
    }, autoScanDelayMs);

    return () => {
      if (autoScanTimerRef.current) {
        clearTimeout(autoScanTimerRef.current);
        autoScanTimerRef.current = null;
      }
    };
  }, [barcode, isPending, mode]);

  function addResolvedLine(resolution: Awaited<ReturnType<typeof resolveBatchScanAction>>) {
    if (resolution.kind === "staff") {
      selectStaffOperator(resolution.staffOperatorId);
      setScanMessage(`${resolution.staffOperatorName} に切り替えました。`);
      return;
    }

    const productLabel = resolution.productName ?? resolution.barcode;
    const shouldIncrementReceiveLine =
      mode === "IN" &&
      resolution.status === "receivable" &&
      resolution.orderRequestId &&
      lines.some((line) => line.orderRequestId === resolution.orderRequestId);
    const shouldIncrementStockOutLine =
      mode === "OUT" &&
      resolution.status === "stock-out-ready" &&
      resolution.productId &&
      !resolution.lotNumber &&
      !resolution.expiryDateText &&
      lines.some(
        (line) =>
          line.status === "stock-out-ready" &&
          line.productId === resolution.productId &&
          !line.lotNumber &&
          !line.expiryDateText,
      );
    const initialQuantity =
      mode === "IN" && resolution.status === "receivable" && resolution.requestedQuantity
        ? resolution.requestedQuantity
        : 1;

    setLines((currentLines) => {
      if (mode === "IN" && resolution.status === "receivable" && resolution.orderRequestId) {
        const existingIndex = currentLines.findIndex((line) => line.orderRequestId === resolution.orderRequestId);

        if (existingIndex >= 0) {
          return currentLines.map((line, index) =>
            index === existingIndex
              ? {
                  ...line,
                  quantity: clampQuantity(line.quantity + 1),
                }
              : line,
          );
        }
      }

      if (
        mode === "OUT" &&
        resolution.status === "stock-out-ready" &&
        resolution.productId &&
        !resolution.lotNumber &&
        !resolution.expiryDateText
      ) {
        const existingIndex = currentLines.findIndex(
          (line) =>
            line.status === "stock-out-ready" &&
            line.productId === resolution.productId &&
            !line.lotNumber &&
            !line.expiryDateText,
        );

        if (existingIndex >= 0) {
          return currentLines.map((line, index) =>
            index === existingIndex
              ? {
                  ...line,
                  quantity: clampQuantity(line.quantity + 1),
                }
              : line,
          );
        }
      }

      return [
        ...currentLines,
        {
          id: createLineId(),
          status: resolution.status,
          barcode: resolution.barcode,
          productId: resolution.productId,
          productName: resolution.productName,
          productCode: resolution.productCode,
          currentQuantity: resolution.currentQuantity,
          orderRequestId: resolution.orderRequestId,
          requestedQuantity: resolution.requestedQuantity,
          supplierName: resolution.supplierName,
          lotNumber: resolution.lotNumber,
          expiryDateText: resolution.expiryDateText,
          quantity: initialQuantity,
          message: resolution.message,
        },
      ];
    });
    setScanMessage(
      shouldIncrementReceiveLine || shouldIncrementStockOutLine
        ? `${productLabel} の数量を +1 しました。`
        : readyStatuses.has(resolution.status)
          ? `${productLabel} を追加しました。`
          : resolution.message,
    );
  }

  function handleScanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (autoScanTimerRef.current) {
      clearTimeout(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }

    const nextBarcode = barcode.trim();

    if (!nextBarcode) {
      setScanMessage("バーコードを読み取ってください。");
      return;
    }

    startTransition(async () => {
      try {
        const resolution = await resolveBatchScanAction({
          mode,
          barcode: nextBarcode,
        });

        addResolvedLine(resolution);
        setBarcode("");
      } catch (error) {
        setScanMessage(error instanceof Error ? error.message : "読み取りを処理できませんでした。");
      }
    });
  }

  function changeMode(nextMode: BatchMode) {
    if (isFixedMode) {
      return;
    }

    if (nextMode === mode) {
      return;
    }

    if (lines.length > 0 && !window.confirm("現在のリストをクリアしてモードを切り替えます。よろしいですか？")) {
      return;
    }

    setMode(nextMode);
    setLines([]);
    setResult({});
    setScanMessage("");
  }

  function updateLineQuantity(lineId: string, quantity: number) {
    setLines((currentLines) =>
      currentLines.map((line) => (line.id === lineId ? { ...line, quantity: clampQuantity(quantity) } : line)),
    );
  }

  function removeLine(lineId: string) {
    setLines((currentLines) => currentLines.filter((line) => line.id !== lineId));
  }

  function clearLines() {
    if (lines.length === 0 || window.confirm("リストをクリアします。よろしいですか？")) {
      setLines([]);
      setResult({});
      setScanMessage("");
    }
  }

  function confirmBatch(skipShortageLines = false) {
    if (!selectedStaffOperatorId) {
      setResult({
        status: "error",
        message: "作業スタッフを選択してください。",
      });
      return;
    }

    const staffLabel = selectedStaffOperator?.displayName ?? "未選択";
    const message =
      mode === "IN"
        ? `${staffLabel} で ${readyLines.length} 件の納品を一括確定します。よろしいですか？`
        : `${staffLabel} で ${readyLines.length} 件の出庫を一括確定します。よろしいですか？`;

    if (!window.confirm(message)) {
      return;
    }

    startTransition(async () => {
      const formData = new FormData();

      formData.set("staffOperatorId", selectedStaffOperatorId);

      if (mode === "IN") {
        formData.set(
          "lines",
          JSON.stringify(
            readyLines.map((line) => ({
              orderRequestId: line.orderRequestId,
              barcode: line.barcode,
              receivedQuantity: line.quantity,
              receivedMemo: "",
              receivedLotNumber: line.lotNumber ?? "",
              receivedExpiryDateText: line.expiryDateText ?? "",
            })),
          ),
        );

        const nextResult = await batchOrderReceiveAction({}, formData);
        setResult(nextResult);
        if (nextResult.status === "success") {
          setLines([]);
        }
        return;
      }

      formData.set("reason", reason);
      formData.set("reasonNote", reasonNote);
      if (skipShortageLines) {
        formData.set("skipShortageLines", "on");
      }
      formData.set(
        "lines",
        JSON.stringify(
          readyLines.map((line) => ({
            productId: line.productId,
            barcode: line.barcode,
            quantity: line.quantity,
          })),
        ),
      );

      const nextResult = await batchStockOutAction({}, formData);
      setResult(nextResult);
      if (nextResult.status === "success") {
        setLines([]);
      }
    });
  }

  const totalQuantity = useMemo(() => readyLines.reduce((total, line) => total + line.quantity, 0), [readyLines]);
  const displayedLines = useMemo(() => [...lines].reverse(), [lines]);

  return (
    <div className="grid gap-3">
      <section className="sticky top-0 z-10 rounded border border-line bg-white/95 px-3 py-2.5 shadow-panel backdrop-blur">
        <div
          className={
            isFixedMode
              ? "grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(260px,auto)] lg:items-center"
              : "grid gap-2 lg:grid-cols-[150px_minmax(0,1fr)_minmax(260px,auto)] lg:items-center"
          }
        >
          {!isFixedMode ? (
            <div>
              <p className="text-xs font-semibold text-muted">モード</p>
              <div className="mt-1 grid grid-cols-2 gap-1 rounded border border-line bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => changeMode("OUT")}
                  className={
                    mode === "OUT"
                      ? "h-8 rounded bg-ink px-3 text-sm font-semibold text-white"
                      : "h-8 rounded px-3 text-sm font-semibold text-muted transition hover:bg-white hover:text-accent"
                  }
                >
                  出庫
                </button>
                <button
                  type="button"
                  onClick={() => changeMode("IN")}
                  className={
                    mode === "IN"
                      ? "h-8 rounded bg-accent px-3 text-sm font-semibold text-white"
                      : "h-8 rounded px-3 text-sm font-semibold text-muted transition hover:bg-white hover:text-accent"
                  }
                >
                  納品
                </button>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleScanSubmit} className="grid gap-1">
            <div className="flex min-h-5 items-center justify-between gap-3">
              <label className="text-xs font-semibold text-muted" htmlFor="batch-barcode-input">
                {mode === "IN" ? "納品バーコード / スタッフバーコード" : "商品バーコード / スタッフバーコード"}
              </label>
              <p className="truncate text-xs font-semibold text-ink">
                {scanMessage || "読み取り待ち"}
              </p>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                id="batch-barcode-input"
                ref={inputRef}
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                autoFocus
                placeholder="スキャナーで読み取り"
                className="h-10 rounded border border-line px-3 font-mono text-base font-semibold text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex h-10 items-center rounded bg-accent px-4 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "読み取り中" : "追加"}
              </button>
            </div>
          </form>

          <div className="flex flex-wrap gap-1.5 lg:justify-end">
            <div className="min-w-36 rounded border border-blue-100 bg-blue-50 px-2.5 py-1">
              <span className="text-[11px] font-semibold text-blue-900">作業スタッフ</span>
              <span className="ml-2 text-sm font-semibold text-ink">
                {selectedStaffOperator ? selectedStaffOperator.displayName : hasStaffOperators ? "未選択" : "未登録"}
              </span>
            </div>
            <div className="rounded border border-line bg-gray-50 px-2.5 py-1">
              <span className="text-[11px] font-semibold text-muted">対象</span>
              <span className="ml-2 text-sm font-semibold text-ink">{readyLines.length}件 / {totalQuantity}</span>
            </div>
            <div className="rounded border border-line bg-gray-50 px-2.5 py-1">
              <span className="text-[11px] font-semibold text-muted">確認</span>
              <span className="ml-2 text-sm font-semibold text-ink">{blockedLines}件</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section className="rounded border border-line bg-white shadow-panel">
          <div className="grid gap-3 border-b border-line px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-semibold text-muted">
                {mode === "IN" ? "受領確認リスト" : "出庫リスト"}
              </p>
              <p className="mt-0.5 text-base font-semibold text-ink">
                確定対象 {readyLines.length} 件 / 数量 {totalQuantity} / 確認必要 {blockedLines} 件
              </p>
            </div>
            <button
              type="button"
              onClick={clearLines}
              disabled={lines.length === 0 || isPending}
              className="h-9 rounded border border-line px-3 text-xs font-semibold text-muted transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
            >
              クリア
            </button>
          </div>

          {lines.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted">まだリストに行はありません。</div>
          ) : (
            <div className="divide-y divide-line">
              {displayedLines.map((line) => {
              const isReceiveOver =
                line.status === "receivable" &&
                line.requestedQuantity !== null &&
                line.quantity > line.requestedQuantity;
              const isStockOutOver =
                line.status === "stock-out-ready" &&
                line.currentQuantity !== null &&
                line.quantity > line.currentQuantity;

              return (
                <article key={line.id} className={`grid gap-3 border-l-4 p-3 ${getLineTone(line.status)} lg:grid-cols-[1fr_auto]`}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-ink">{line.productName ?? "確認必要"}</p>
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-muted">
                        {line.status === "receivable"
                          ? "納品OK"
                          : line.status === "stock-out-ready"
                            ? "出庫OK"
                            : "確認必要"}
                      </span>
                    </div>
                    <p className="mt-1 break-all font-mono text-xs text-muted">{line.barcode}</p>
                    <p className="mt-1 text-xs text-muted">
                      {line.productCode ?? "コード未設定"} / 発注先 {line.supplierName ?? "-"} / 現在庫{" "}
                      {line.currentQuantity ?? "-"}
                      {line.requestedQuantity !== null ? ` / 発注数 ${line.requestedQuantity}` : ""}
                    </p>
                    {line.lotNumber || line.expiryDateText ? (
                      <p className="mt-1 text-xs text-muted">
                        ロット {line.lotNumber ?? "-"} / 有効期限 {line.expiryDateText ?? "-"}
                      </p>
                    ) : null}
                    <p className={readyStatuses.has(line.status) ? "mt-1 text-xs text-muted" : "mt-1 text-xs font-semibold text-warning"}>
                      {line.message}
                    </p>
                    {isReceiveOver ? (
                      <p className="mt-2 rounded bg-red-50 px-3 py-2 text-xs font-semibold text-danger">
                        納品数量が発注数量を超えています。
                      </p>
                    ) : null}
                    {isStockOutOver ? (
                      <p className="mt-2 rounded bg-red-50 px-3 py-2 text-xs font-semibold text-danger">
                        現在庫を超える数量です。
                      </p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-[36px_72px_36px_auto] gap-2 self-start">
                    <button
                      type="button"
                      onClick={() => updateLineQuantity(line.id, line.quantity - 1)}
                      className="h-9 rounded border border-line text-base font-semibold text-muted transition hover:border-accent hover:text-accent"
                      aria-label="数量を減らす"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      step={1}
                      value={line.quantity}
                      onChange={(event) => updateLineQuantity(line.id, Number(event.target.value))}
                      disabled={!readyStatuses.has(line.status)}
                      className="h-9 rounded border border-line px-2 text-center text-base font-semibold outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-gray-100 disabled:text-muted"
                    />
                    <button
                      type="button"
                      onClick={() => updateLineQuantity(line.id, line.quantity + 1)}
                      disabled={!readyStatuses.has(line.status)}
                      className="h-9 rounded border border-line text-base font-semibold text-muted transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="数量を増やす"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="h-9 rounded border border-line px-3 text-xs font-semibold text-muted transition hover:border-danger hover:text-danger"
                    >
                      削除
                    </button>
                  </div>
                </article>
              );
            })}
            </div>
          )}
        </section>

        <aside className="grid gap-4 xl:sticky xl:top-32">
          {mode === "OUT" ? (
            <section className="rounded border border-line bg-white p-4 shadow-panel">
              <p className="text-sm font-semibold text-muted">一括出庫の理由</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {barcodeStockOutReasons.map((option) => (
                  <label
                    key={option}
                    className={
                      reason === option
                        ? "inline-flex h-10 cursor-pointer items-center justify-center rounded bg-ink px-3 text-sm font-semibold text-white"
                        : "inline-flex h-10 cursor-pointer items-center justify-center rounded border border-line bg-white px-3 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                    }
                  >
                    <input
                      type="radio"
                      value={option}
                      checked={reason === option}
                      onChange={() => setReason(option)}
                      className="sr-only"
                    />
                    {option}
                  </label>
                ))}
              </div>
              <label className="mt-4 grid gap-2 text-sm font-semibold text-muted">
                補足メモ
                <textarea
                  value={reasonNote}
                  onChange={(event) => setReasonNote(event.target.value)}
                  rows={3}
                  maxLength={160}
                  placeholder="任意"
                  className="rounded border border-line px-3 py-2 text-sm font-normal text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>
            </section>
          ) : null}

          <section className="rounded border border-line bg-white p-4 shadow-panel">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded bg-gray-50 px-2 py-2">
                <p className="text-[11px] font-semibold text-muted">対象</p>
                <p className="text-lg font-semibold text-ink">{readyLines.length}</p>
              </div>
              <div className="rounded bg-gray-50 px-2 py-2">
                <p className="text-[11px] font-semibold text-muted">数量</p>
                <p className="text-lg font-semibold text-ink">{totalQuantity}</p>
              </div>
              <div className="rounded bg-gray-50 px-2 py-2">
                <p className="text-[11px] font-semibold text-muted">確認</p>
                <p className="text-lg font-semibold text-ink">{blockedLines}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => confirmBatch(false)}
              disabled={!canConfirm}
              className="mt-4 h-11 w-full rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "確定中" : mode === "IN" ? "一括受領確定" : "一括出庫確定"}
            </button>
          </section>

          {mode === "OUT" && invalidStockOutLines.length > 0 ? (
            <section className="rounded border border-yellow-200 bg-yellow-50 p-4">
              <p className="text-sm font-semibold text-warning">
                在庫不足行があります。通常は確定できません。
              </p>
              <button
                type="button"
                onClick={() => confirmBatch(true)}
                disabled={!selectedStaffOperatorId || readyLines.length === invalidStockOutLines.length || isPending}
                className="mt-3 h-10 w-full rounded border border-warning/30 bg-white px-4 text-sm font-semibold text-warning transition hover:border-warning disabled:cursor-not-allowed disabled:opacity-50"
              >
                不足行を除外して確定
              </button>
            </section>
          ) : null}

          {result.message ? (
            <section
              className={
                result.status === "success"
                  ? "rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-accent"
                  : "rounded border border-danger/30 bg-red-50 p-4 text-sm font-semibold text-danger"
              }
            >
              <p>{result.message}</p>
              {result.skippedMessages && result.skippedMessages.length > 0 ? (
                <ul className="mt-2 grid gap-1 text-xs font-normal">
                  {result.skippedMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
