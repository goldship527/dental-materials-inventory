"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useWorkStaffSelection } from "@/components/domain/work-staff-selection";
import { barcodeStockMoveAction, type BarcodeStockActionState } from "@/lib/actions/barcode-stock";
import { barcodeStockInReasons, barcodeStockOutReasons } from "@/lib/barcode/stock-reasons";
import type { StaffOperatorOption } from "@/lib/db/staff-operators";

export const productBarcodeInputId = "barcode-stock-product-barcode";

type BarcodeStockFormProps = {
  barcode: string;
  productId: string;
  currentQuantity: number;
  clinicId: string;
  staffOperators: StaffOperatorOption[];
};

const initialState: BarcodeStockActionState = {};

export function BarcodeStockForm({
  barcode,
  productId,
  currentQuantity,
  clinicId,
  staffOperators,
}: BarcodeStockFormProps) {
  const [state, formAction, isPending] = useActionState(barcodeStockMoveAction, initialState);
  const { hasStaffOperators, selectedStaffOperator, selectedStaffOperatorId } = useWorkStaffSelection({
    clinicId,
    staffOperators,
  });
  const [movementType, setMovementType] = useState<"OUT" | "IN">("OUT");
  const [reason, setReason] = useState<string>("使用");
  const [quantity, setQuantity] = useState(1);
  const displayQuantity = state.afterQuantity ?? currentQuantity;
  const reasonOptions = useMemo(
    () => (movementType === "OUT" ? barcodeStockOutReasons : barcodeStockInReasons),
    [movementType],
  );
  const isSubmitDisabled =
    isPending || !selectedStaffOperatorId || (movementType === "OUT" && quantity > displayQuantity);

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    const productBarcodeInput = document.getElementById(productBarcodeInputId);

    if (productBarcodeInput instanceof HTMLInputElement) {
      productBarcodeInput.focus();
      productBarcodeInput.select();
    }
  }, [state.status, state.afterQuantity]);

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
      <input type="hidden" name="staffOperatorId" value={selectedStaffOperatorId} />

      <div className="mb-4">
        <p className="text-xs font-semibold text-accent">入出庫確認</p>
        <h2 className="mt-1 text-xl font-semibold">数量と理由を確認して確定</h2>
        <p className="mt-2 text-sm text-muted">
          確定後は商品バーコード欄へ戻ります。画面上部で選んだ作業スタッフで記録します。
        </p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-line bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold text-muted">現在の商品バーコード</p>
          <p className="mt-1 break-all font-mono text-sm font-semibold text-ink">{barcode}</p>
        </div>
        <div className="rounded border border-line bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold text-muted">次に読むもの</p>
          <p className="mt-1 text-sm font-semibold text-ink">確定後の商品バーコード</p>
        </div>
      </div>

      <section className="mb-5 rounded border border-blue-100 bg-blue-50 p-4">
        <p className="text-xs font-semibold text-blue-900">作業スタッフ</p>
        <p className="mt-1 text-sm font-semibold text-ink">
          {selectedStaffOperator ? selectedStaffOperator.displayName : hasStaffOperators ? "未選択" : "未登録"}
        </p>
        <p className="mt-2 text-xs leading-5 text-blue-800">
          {hasStaffOperators
            ? "画面上部で作業スタッフを選んでから確定してください。"
            : "このクリニックで有効な作業スタッフが登録されていません。"}
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
          <p className="mt-3 text-sm text-muted">
            現在庫: <span className="font-semibold text-ink">{displayQuantity}</span>
          </p>
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
      <p className="mt-2 text-xs text-muted">個人情報や患者情報は入力しないでください。</p>

      {state.message ? (
        <div
          className={
            state.status === "success"
              ? "mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-accent"
              : "mt-4 rounded border border-danger/30 bg-red-50 px-4 py-3 text-sm font-semibold text-danger"
          }
        >
          <p>{state.message}</p>
          {state.status === "success" && state.lastProductName ? (
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-muted">最後に処理した商品</dt>
                <dd className="mt-1 text-ink">{state.lastProductName}</dd>
              </div>
              <div>
                <dt className="text-muted">処理内容</dt>
                <dd className="mt-1 text-ink">
                  {state.lastMovementLabel} {state.lastQuantity}
                </dd>
              </div>
              <div>
                <dt className="text-muted">処理後在庫</dt>
                <dd className="mt-1 text-ink">{state.afterQuantity}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitDisabled}
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
