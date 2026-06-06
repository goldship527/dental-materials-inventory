"use client";

import { useActionState } from "react";
import { useWorkStaffSelection } from "@/components/domain/work-staff-selection";
import { moveStockUsageWithStateAction, type StockUsageActionState } from "@/lib/actions/stock-usage";
import type { StaffOperatorOption } from "@/lib/db/staff-operators";

type ProductStockUsagePanelProps = {
  stockItemId: string;
  availableQuantity: number;
  inUseQuantity: number;
  discardedQuantity: number;
  clinicId: string;
  staffOperators: StaffOperatorOption[];
};

const initialState: StockUsageActionState = {};

function StockUsageForm({
  stockItemId,
  operation,
  title,
  maxQuantity,
  clinicId,
  staffOperators,
  discardFrom,
}: {
  stockItemId: string;
  operation: "START_USE" | "END_USE" | "DISCARD";
  title: string;
  maxQuantity: number;
  clinicId: string;
  staffOperators: StaffOperatorOption[];
  discardFrom?: "AVAILABLE" | "IN_USE";
}) {
  const [state, formAction, isPending] = useActionState(moveStockUsageWithStateAction, initialState);
  const { hasStaffOperators, selectedStaffOperator, selectedStaffOperatorId } = useWorkStaffSelection({
    clinicId,
    staffOperators,
  });
  const isDisabled = maxQuantity <= 0 || selectedStaffOperatorId.length === 0 || isPending;

  return (
    <form action={formAction} className="grid gap-3 rounded border border-line bg-gray-50 p-3">
      <input type="hidden" name="stockItemId" value={stockItemId} />
      <input type="hidden" name="operation" value={operation} />
      <input type="hidden" name="staffOperatorId" value={selectedStaffOperatorId} />
      {discardFrom ? <input type="hidden" name="discardFrom" value={discardFrom} /> : null}

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <span className="text-xs font-semibold text-muted">上限 {maxQuantity}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-xs font-semibold text-muted">
          数量
          <input
            type="number"
            name="quantity"
            defaultValue="1"
            min="1"
            max={Math.max(1, maxQuantity)}
            inputMode="numeric"
            className="h-10 rounded border border-line bg-white px-3 text-right text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <div className="grid gap-1 text-xs font-semibold text-muted sm:col-span-2">
          作業スタッフ
          <p className="flex h-10 items-center rounded border border-line bg-white px-3 text-sm text-ink">
            {selectedStaffOperator ? selectedStaffOperator.displayName : "画面上部で選択してください"}
          </p>
        </div>
      </div>

      <label className="grid gap-1 text-xs font-semibold text-muted">
        メモ
        <input
          name="memo"
          maxLength={200}
          className="h-10 rounded border border-line bg-white px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </label>

      <button
        type="submit"
        disabled={isDisabled}
        className="justify-self-start rounded bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "更新中" : title}
      </button>
      {state.message ? (
        <p className={state.status === "success" ? "text-xs font-semibold text-accent" : "text-xs font-semibold text-danger"}>
          {state.message}
        </p>
      ) : null}
      {!hasStaffOperators ? (
        <p className="text-xs font-semibold text-danger">有効な作業スタッフがありません。</p>
      ) : selectedStaffOperatorId.length === 0 ? (
        <p className="text-xs font-semibold text-warning">画面上部で作業スタッフを選択してください。</p>
      ) : null}
    </form>
  );
}

export function ProductStockUsagePanel({
  stockItemId,
  availableQuantity,
  inUseQuantity,
  discardedQuantity,
  clinicId,
  staffOperators,
}: ProductStockUsagePanelProps) {
  return (
    <section className="rounded border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">使用中管理</h2>
          <p className="mt-1 text-sm text-muted">
            使用可能 {availableQuantity} / 使用中 {inUseQuantity} / 廃棄済み累計 {discardedQuantity}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <StockUsageForm
          stockItemId={stockItemId}
          operation="START_USE"
          title="使用開始"
          maxQuantity={availableQuantity}
          clinicId={clinicId}
          staffOperators={staffOperators}
        />
        <StockUsageForm
          stockItemId={stockItemId}
          operation="END_USE"
          title="使用終了"
          maxQuantity={inUseQuantity}
          clinicId={clinicId}
          staffOperators={staffOperators}
        />
        <StockUsageForm
          stockItemId={stockItemId}
          operation="DISCARD"
          title="廃棄（使用可能から）"
          maxQuantity={availableQuantity}
          clinicId={clinicId}
          staffOperators={staffOperators}
          discardFrom="AVAILABLE"
        />
        <StockUsageForm
          stockItemId={stockItemId}
          operation="DISCARD"
          title="廃棄（使用中から）"
          maxQuantity={inUseQuantity}
          clinicId={clinicId}
          staffOperators={staffOperators}
          discardFrom="IN_USE"
        />
      </div>
    </section>
  );
}
