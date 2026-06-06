"use client";

import { useActionState } from "react";
import { useWorkStaffSelection } from "@/components/domain/work-staff-selection";
import { adjustStockWithStateAction, type StockActionState } from "@/lib/actions/stock";
import type { StaffOperatorOption } from "@/lib/db/staff-operators";

const initialState: StockActionState = {};

type InventoryAdjustFormProps = {
  stockItemId: string;
  quantity: number;
  stockUpdatedAt: number;
  clinicId: string;
  staffOperators: StaffOperatorOption[];
};

export function InventoryAdjustForm({ stockItemId, quantity, stockUpdatedAt, clinicId, staffOperators }: InventoryAdjustFormProps) {
  const [state, formAction, isPending] = useActionState(adjustStockWithStateAction, initialState);
  const { hasStaffOperators, selectedStaffOperator, selectedStaffOperatorId } = useWorkStaffSelection({
    clinicId,
    staffOperators,
  });
  const hasSelectedStaffOperator = selectedStaffOperatorId.length > 0;

  return (
    <form action={formAction} className="grid min-w-[320px] gap-2 sm:min-w-[380px]">
      <input type="hidden" name="stockItemId" value={stockItemId} />
      <input type="hidden" name="expectedQuantity" value={quantity} />
      <input type="hidden" name="expectedUpdatedAt" value={stockUpdatedAt} />
      <input type="hidden" name="staffOperatorId" value={selectedStaffOperatorId} />
      <div className="grid gap-2 sm:grid-cols-[96px_minmax(140px,1fr)_80px] sm:items-end">
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
            className="h-11 rounded border border-line px-3 text-right text-sm font-semibold text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
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
            className="h-11 rounded border border-line px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <button
          type="submit"
          disabled={isPending || !hasSelectedStaffOperator}
          className="h-11 rounded bg-ink px-4 text-xs font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "更新中" : "更新"}
        </button>
      </div>
      <p className="text-xs text-muted">
        現在庫 {quantity} から変更します。作業スタッフ
        {selectedStaffOperator ? `（${selectedStaffOperator.displayName}）` : ""}と理由メモは履歴に残ります。
      </p>
      {!hasStaffOperators ? (
        <p className="rounded bg-red-50 px-3 py-2 text-xs font-semibold text-danger">
          有効な作業スタッフがありません。先に管理画面でスタッフを登録してください。
        </p>
      ) : !hasSelectedStaffOperator ? (
        <p className="rounded bg-yellow-50 px-3 py-2 text-xs font-semibold text-warning">
          画面上部で作業スタッフを選択してください。
        </p>
      ) : null}
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
