"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { barcodeStockMoveAction, type BarcodeStockActionState } from "@/lib/actions/barcode-stock";
import { normalizeBarcodeText } from "@/lib/barcode/normalize";
import { barcodeStockInReasons, barcodeStockOutReasons } from "@/lib/barcode/stock-reasons";

type BarcodeStockFormProps = {
  barcode: string;
  productId: string;
  currentQuantity: number;
};

const initialState: BarcodeStockActionState = {};

export function BarcodeStockForm({ barcode, productId, currentQuantity }: BarcodeStockFormProps) {
  const [state, formAction, isPending] = useActionState(barcodeStockMoveAction, initialState);
  const staffInputRef = useRef<HTMLInputElement>(null);
  const [staffBarcode, setStaffBarcode] = useState("");
  const [movementType, setMovementType] = useState<"OUT" | "IN">("OUT");
  const [reason, setReason] = useState<string>("使用");
  const [quantity, setQuantity] = useState(1);
  const displayQuantity = state.afterQuantity ?? currentQuantity;
  const reasonOptions = useMemo(() => (movementType === "OUT" ? barcodeStockOutReasons : barcodeStockInReasons), [movementType]);

  useEffect(() => {
    setStaffBarcode("");
    staffInputRef.current?.focus();
    staffInputRef.current?.select();
  }, [barcode, productId]);

  useEffect(() => {
    let bufferedText = "";
    let lastKeyAt = 0;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable;
    }

    function clearFlushTimer() {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    }

    function resetBuffer() {
      bufferedText = "";
      lastKeyAt = 0;
      clearFlushTimer();
    }

    function flushBuffer() {
      const scannedText = normalizeBarcodeText(bufferedText);
      resetBuffer();

      if (scannedText.length < 4) {
        return;
      }

      setStaffBarcode(scannedText.toUpperCase());
      staffInputRef.current?.focus();
    }

    function scheduleFlush() {
      clearFlushTimer();
      flushTimer = setTimeout(flushBuffer, 220);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        if (bufferedText) {
          event.preventDefault();
          flushBuffer();
        }
        return;
      }

      if (event.key.length !== 1) {
        return;
      }

      const now = Date.now();

      if (lastKeyAt && now - lastKeyAt > 150) {
        bufferedText = "";
      }

      lastKeyAt = now;
      bufferedText += event.key;
      scheduleFlush();
    }

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      clearFlushTimer();
    };
  }, []);

  function changeMovementType(nextType: "OUT" | "IN") {
    setMovementType(nextType);
    setReason(nextType === "OUT" ? "使用" : "納品");
  }

  function changeQuantity(nextQuantity: number) {
    setQuantity(Math.max(1, Math.min(9999, Math.trunc(Number.isFinite(nextQuantity) ? nextQuantity : 1))));
  }

  function updateStaffBarcode(value: string) {
    setStaffBarcode(normalizeBarcodeText(value).toUpperCase());
  }

  return (
    <form action={formAction} className="rounded border border-line bg-white p-5 shadow-panel">
      <input type="hidden" name="barcode" value={barcode} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="movementType" value={movementType} />

      <div className="mb-4">
        <p className="text-xs font-semibold text-accent">2. 担当者確認</p>
        <h2 className="mt-1 text-xl font-semibold">担当者バーコードを読んでから入出庫を確定</h2>
        <p className="mt-2 text-sm text-muted">
          商品バーコードは読み取り済みです。次に実際に作業する担当者バーコードを読み取り、数量と理由を確認してください。
        </p>
      </div>

      <section className="mb-5 rounded border border-blue-100 bg-blue-50 p-4">
        <label className="grid gap-2 text-sm font-semibold text-blue-900">
          担当者バーコード
          <input
            ref={staffInputRef}
            autoFocus
            autoComplete="off"
            className="h-12 rounded border border-blue-200 bg-white px-3 font-mono text-base text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            maxLength={64}
            name="staffBarcode"
            value={staffBarcode}
            onInput={(event) => updateStaffBarcode(event.currentTarget.value)}
            onChange={(event) => updateStaffBarcode(event.target.value)}
            onCompositionEnd={(event) => updateStaffBarcode(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                updateStaffBarcode(event.currentTarget.value);
              }
            }}
            placeholder="STAFF-0001"
            required
          />
        </label>
        {staffBarcode ? (
          <p className="mt-2 rounded border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-900">
            担当者バーコード読み取り済み: <span className="font-mono">{staffBarcode}</span>
          </p>
        ) : null}
        <p className="mt-2 text-xs leading-5 text-blue-800">
          ログインユーザーとは別に、実際に作業した担当者を履歴へ残します。複数クリニックで作業する担当者は、管理画面で利用できるクリニックを追加します。
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section>
          <p className="text-sm font-semibold text-muted">入出庫区分</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => changeMovementType("OUT")}
              className={
                movementType === "OUT"
                  ? "h-12 rounded bg-ink px-4 text-sm font-semibold text-white"
                  : "h-12 rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              }
            >
              出庫
            </button>
            <button
              type="button"
              onClick={() => changeMovementType("IN")}
              className={
                movementType === "IN"
                  ? "h-12 rounded bg-accent px-4 text-sm font-semibold text-white"
                  : "h-12 rounded border border-line px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              }
            >
              入庫
            </button>
          </div>
          <p className="mt-3 text-sm text-muted">現在庫: <span className="font-semibold text-ink">{displayQuantity}</span></p>
        </section>

        <section>
          <p className="text-sm font-semibold text-muted">数量</p>
          <div className="mt-3 grid grid-cols-[48px_1fr_48px] gap-2">
            <button
              type="button"
              onClick={() => changeQuantity(quantity - 1)}
              className="h-12 rounded border border-line text-lg font-semibold text-muted transition hover:border-accent hover:text-accent"
              aria-label="数量を減らす"
            >
              -
            </button>
            <input
              type="number"
              name="quantity"
              min={1}
              max={9999}
              step={1}
              value={quantity}
              onChange={(event) => changeQuantity(Number(event.target.value))}
              className="h-12 rounded border border-line px-4 text-center text-lg font-semibold outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="button"
              onClick={() => changeQuantity(quantity + 1)}
              className="h-12 rounded border border-line text-lg font-semibold text-muted transition hover:border-accent hover:text-accent"
              aria-label="数量を増やす"
            >
              +
            </button>
          </div>
          {movementType === "OUT" && quantity > displayQuantity ? (
            <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-danger">
              現在庫を超える数量は出庫できません。
            </p>
          ) : null}
        </section>
      </div>

      <section className="mt-5">
        <p className="text-sm font-semibold text-muted">理由</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {reasonOptions.map((option) => (
            <label
              key={option}
              className={
                reason === option
                  ? "inline-flex h-11 cursor-pointer items-center rounded bg-accent px-4 text-sm font-semibold text-white"
                  : "inline-flex h-11 cursor-pointer items-center rounded border border-line bg-white px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
              }
            >
              <input
                type="radio"
                name="reason"
                value={option}
                checked={reason === option}
                onChange={() => setReason(option)}
                className="sr-only"
              />
              {option}
            </label>
          ))}
        </div>
      </section>

      <label className="mt-5 grid gap-2 text-sm font-semibold text-muted">
        補足メモ
        <textarea
          name="reasonNote"
          rows={3}
          maxLength={160}
          placeholder="任意"
          className="rounded border border-line px-3 py-2 text-sm font-normal text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </label>
      <p className="mt-2 text-xs text-muted">
        個人情報や秘密情報は入力しないでください。
      </p>

      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-accent"
              : "mt-4 rounded border border-danger/30 bg-red-50 px-4 py-3 text-sm font-semibold text-danger"
          }
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || (movementType === "OUT" && quantity > displayQuantity)}
        className={
          movementType === "OUT"
            ? "mt-5 h-12 w-full rounded bg-ink px-5 text-base font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            : "mt-5 h-12 w-full rounded bg-accent px-5 text-base font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {isPending ? "確定中" : movementType === "OUT" ? "出庫を確定" : "入庫を確定"}
      </button>
    </form>
  );
}
