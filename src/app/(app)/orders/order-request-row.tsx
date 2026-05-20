"use client";

import { useActionState } from "react";
import {
  updateOrderRequestQuantityWithStateAction,
  updateOrderRequestStatusWithStateAction,
  type OrderActionState,
} from "@/lib/actions/orders";
import type { OrderRequestRow } from "@/lib/db/orders";
import { orderRequestStatusLabels, type OrderRequestStatusValue } from "@/lib/orders/status";

const initialState: OrderActionState = {};

type OrderRequestRowProps = {
  row: OrderRequestRow;
};

const statusOptions: OrderRequestStatusValue[] = ["DRAFT", "CONFIRMED", "SKIPPED"];

export function OrderRequestTableRow({ row }: OrderRequestRowProps) {
  const [quantityState, quantityAction, isQuantityPending] = useActionState(
    updateOrderRequestQuantityWithStateAction,
    initialState,
  );
  const [statusState, statusAction, isStatusPending] = useActionState(
    updateOrderRequestStatusWithStateAction,
    initialState,
  );
  const activeState = statusState.message ? statusState : quantityState;

  return (
    <tr className="align-top print:break-inside-avoid">
      <td className="border-b border-line px-4 py-3 print:border print:border-black print:px-2 print:py-1.5">
        <a
          className="font-semibold text-accent hover:underline print:text-black print:no-underline"
          href={`/products/${row.productId}`}
        >
          {row.name}
        </a>
        <p className="mt-1 text-xs text-muted print:mt-0.5 print:text-[9px] print:text-black">
          {row.productCode ?? "コード未設定"} / {row.category ?? "未分類"}
        </p>
        {activeState.message ? (
          <p
            className={
              activeState.status === "success"
                ? "mt-2 rounded bg-emerald-50 px-3 py-2 text-xs font-semibold text-accent print:hidden"
                : "mt-2 rounded bg-red-50 px-3 py-2 text-xs font-semibold text-danger print:hidden"
            }
          >
            {activeState.message}
          </p>
        ) : null}
      </td>
      <td className="border-b border-line px-4 py-3 text-right font-semibold print:border print:border-black print:px-2 print:py-1.5">
        {row.quantity}
      </td>
      <td className="border-b border-line px-4 py-3 text-right print:border print:border-black print:px-2 print:py-1.5">
        {row.minStock}
      </td>
      <td className="border-b border-line px-4 py-3 text-right text-danger print:border print:border-black print:px-2 print:py-1.5 print:text-black">
        {row.shortageCount}
      </td>
      <td className="border-b border-line px-4 py-3 print:border print:border-black print:px-2 print:py-1.5">
        {row.supplierId && row.supplierName ? (
          <a
            className="text-accent hover:underline print:text-black print:no-underline"
            href={`/suppliers/${row.supplierId}`}
          >
            {row.supplierName}
          </a>
        ) : (
          "-"
        )}
      </td>
      <td className="border-b border-line px-4 py-3 print:border print:border-black print:px-2 print:py-1.5 print:text-right">
        {row.requestedQuantity}
      </td>
      <td className="border-b border-line px-4 py-3 print:hidden">
        <form action={quantityAction} className="grid gap-2">
          <input type="hidden" name="orderRequestId" value={row.id} />
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="requestedQuantity"
              defaultValue={row.requestedQuantity}
              className="h-10 w-24 rounded border border-line px-3 text-right outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="submit"
              disabled={isQuantityPending}
              className="h-10 rounded bg-ink px-3 text-xs font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isQuantityPending ? "更新中" : "更新"}
            </button>
          </div>
        </form>
      </td>
      <td className="border-b border-line px-4 py-3 print:hidden">
        <form action={statusAction} className="grid gap-2">
          <input type="hidden" name="orderRequestId" value={row.id} />
          <select
            name="status"
            defaultValue={row.status}
            className="h-10 rounded border border-line bg-white px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {orderRequestStatusLabels[status]}
              </option>
            ))}
          </select>
          <textarea
            name="memo"
            defaultValue={row.memo ?? ""}
            placeholder="見送り理由・備考"
            maxLength={200}
            className="min-h-20 rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="submit"
            disabled={isStatusPending}
            className="h-9 rounded border border-line px-3 text-xs font-semibold text-muted transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStatusPending ? "変更中" : "状態・メモ更新"}
          </button>
        </form>
      </td>
      <td className="hidden border-b border-line px-4 py-3 print:table-cell print:border print:border-black print:px-2 print:py-1.5 print:font-semibold">
        {orderRequestStatusLabels[row.status]}
      </td>
      <td className="hidden border-b border-line px-4 py-3 print:table-cell print:border print:border-black print:px-2 print:py-1.5">
        {row.memo ?? "-"}
      </td>
      <td className="hidden border-b border-line px-4 py-3 print:table-cell print:border print:border-black print:px-2 print:py-1.5" />
    </tr>
  );
}
