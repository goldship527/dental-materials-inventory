"use client";

import { useActionState } from "react";
import { moveStockUsageWithStateAction, type StockUsageActionState } from "@/lib/actions/stock-usage";
import type { StaffOperatorOption } from "@/lib/db/staff-operators";

type ProductStockUsagePanelProps = {
  stockItemId: string;
  availableQuantity: number;
  inUseQuantity: number;
  discardedQuantity: number;
  staffOperators: StaffOperatorOption[];
};

const initialState: StockUsageActionState = {};

function StockUsageForm({
  stockItemId,
  operation,
  title,
  maxQuantity,
  staffOperators,
  discardFrom,
}: {
  stockItemId: string;
  operation: "START_USE" | "END_USE" | "DISCARD";
  title: string;
  maxQuantity: number;
  staffOperators: StaffOperatorOption[];
  discardFrom?: "AVAILABLE" | "IN_USE";
}) {
  const [state, formAction, isPending] = useActionState(moveStockUsageWithStateAction, initialState);
  const isDisabled = maxQuantity <= 0 || staffOperators.length === 0 || isPending;

  return (
    <form action={formAction} className="grid gap-3 rounded border border-line bg-gray-50 p-3">
      <input type="hidden" name="stockItemId" value={stockItemId} />
      <input type="hidden" name="operation" value={operation} />
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
        <label className="grid gap-1 text-xs font-semibold text-muted sm:col-span-2">
          作業スタッフ
          <select
            name="staffOperatorId"
            defaultValue=""
            className="h-10 rounded border border-line bg-white px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">選択してください</option>
            {staffOperators.map((staffOperator) => (
              <option key={staffOperator.id} value={staffOperator.id}>
                {staffOperator.displayName}
              </option>
            ))}
          </select>
        </label>
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
    </form>
  );
}

export function ProductStockUsagePanel({
  stockItemId,
  availableQuantity,
  inUseQuantity,
  discardedQuantity,
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
          staffOperators={staffOperators}
        />
        <StockUsageForm
          stockItemId={stockItemId}
          operation="END_USE"
          title="使用終了"
          maxQuantity={inUseQuantity}
          staffOperators={staffOperators}
        />
        <StockUsageForm
          stockItemId={stockItemId}
          operation="DISCARD"
          title="廃棄（使用可能から）"
          maxQuantity={availableQuantity}
          staffOperators={staffOperators}
          discardFrom="AVAILABLE"
        />
        <StockUsageForm
          stockItemId={stockItemId}
          operation="DISCARD"
          title="廃棄（使用中から）"
          maxQuantity={inUseQuantity}
          staffOperators={staffOperators}
          discardFrom="IN_USE"
        />
      </div>
    </section>
  );
}
