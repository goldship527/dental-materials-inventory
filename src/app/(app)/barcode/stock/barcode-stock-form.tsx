"use client";

import { useActionState, useMemo, useState } from "react";
import { barcodeStockMoveAction, type BarcodeStockActionState } from "@/lib/actions/barcode-stock";

type BarcodeStockFormProps = {
  barcode: string;
  productId: string;
  currentQuantity: number;
};

const outReasons = ["使用", "棚卸調整", "その他"] as const;
const inReasons = ["納品", "返品戻り", "棚卸調整", "その他"] as const;
const initialState: BarcodeStockActionState = {};

export function BarcodeStockForm({ barcode, productId, currentQuantity }: BarcodeStockFormProps) {
  const [state, formAction, isPending] = useActionState(barcodeStockMoveAction, initialState);
  const [movementType, setMovementType] = useState<"OUT" | "IN">("OUT");
  const [reason, setReason] = useState<string>("使用");
  const [quantity, setQuantity] = useState(1);
  const displayQuantity = state.afterQuantity ?? currentQuantity;
  const reasonOptions = useMemo(() => (movementType === "OUT" ? outReasons : inReasons), [movementType]);

  function changeMovementType(nextType: "OUT" | "IN") {
    setMovementType(nextType);
    setReason(nextType === "OUT" ? "使用" : "納品");
  }

  function changeQuantity(nextQuantity: number) {
    setQuantity(Math.max(1, Math.min(9999, Math.trunc(Number.isFinite(nextQuantity) ? nextQuantity : 1))));
  }

  return (
    <form action={formAction} className="rounded border border-line bg-white p-5 shadow-panel">
      <input type="hidden" name="barcode" value={barcode} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="movementType" value={movementType} />

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
                  ? "inline-flex h-10 cursor-pointer items-center rounded bg-accent px-4 text-sm font-semibold text-white"
                  : "inline-flex h-10 cursor-pointer items-center rounded border border-line bg-white px-4 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
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
