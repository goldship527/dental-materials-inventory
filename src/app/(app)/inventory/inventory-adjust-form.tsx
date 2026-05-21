"use client";

import { useActionState } from "react";
import { adjustStockWithStateAction, type StockActionState } from "@/lib/actions/stock";

const initialState: StockActionState = {};

type InventoryAdjustFormProps = {
  stockItemId: string;
  quantity: number;
  stockUpdatedAt: number;
};

export function InventoryAdjustForm({ stockItemId, quantity, stockUpdatedAt }: InventoryAdjustFormProps) {
  const [state, formAction, isPending] = useActionState(adjustStockWithStateAction, initialState);

  return (
    <form action={formAction} className="grid min-w-[380px] gap-2">
      <input type="hidden" name="stockItemId" value={stockItemId} />
      <input type="hidden" name="expectedQuantity" value={quantity} />
      <input type="hidden" name="expectedUpdatedAt" value={stockUpdatedAt} />
      <div className="grid gap-2 sm:grid-cols-[96px_minmax(180px,1fr)_80px] sm:items-end">
        <label className="grid gap-1 text-xs font-semibold text-muted">
          新数量
          <input
            type="number"
            name="quantity"
            min="0"
            max="9999"
            inputMode="numeric"
            defaultValue={quantity}
            required
            className="h-10 rounded border border-line px-3 text-right text-sm font-semibold text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-muted">
          理由メモ
          <input
            type="text"
            name="reason"
            placeholder="例: 棚卸差異、補充、使用"
            required
            maxLength={200}
            className="h-10 rounded border border-line px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded bg-ink px-4 text-xs font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "更新中" : "更新"}
        </button>
      </div>
      <p className="text-xs text-muted">現在庫 {quantity} から変更します。理由メモは履歴に残ります。</p>
      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "rounded bg-emerald-50 px-3 py-2 text-xs font-semibold text-accent"
              : "rounded bg-red-50 px-3 py-2 text-xs font-semibold text-danger"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
