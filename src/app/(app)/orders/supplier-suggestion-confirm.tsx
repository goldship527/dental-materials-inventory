"use client";

import { useActionState, type ReactNode } from "react";
import {
  confirmOrderSuggestionsWithStateAction,
  type OrderActionState,
} from "@/lib/actions/orders";

type Props = { orderRequestIds: string[]; children: ReactNode };
const initialState: OrderActionState = {};

export function SupplierSuggestionConfirm({ orderRequestIds, children }: Props) {
  const [state, action, pending] = useActionState(confirmOrderSuggestionsWithStateAction, initialState);
  if (orderRequestIds.length === 0 && !state.message) return null;

  return (
    <section className="overflow-hidden rounded border border-line bg-panel print:break-inside-avoid print:rounded-none print:border-ink">
      <div className="flex flex-col gap-2 border-b border-line bg-tint px-3 py-2 text-sm lg:flex-row lg:items-start lg:justify-between print:border-ink print:bg-panel print:px-2 print:py-1.5 print:text-xs">
        <div>
          <h3 className="font-semibold">確認待ち</h3>
          <p className="mt-0.5 text-xs text-muted print:text-ink">在庫変動から自動計算・スタッフ確認待ち</p>
          {state.message ? (
            <p role="status" aria-live="polite"
              className={state.status === "error" ? "mt-2 text-sm font-semibold text-danger print:hidden" : "mt-2 text-sm font-semibold text-success print:hidden"}>
              {state.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <span className="rounded border border-line bg-panel/80 px-2 py-1 text-xs font-semibold text-muted print:border-ink print:text-ink">
            {orderRequestIds.length} 件
          </span>
          {orderRequestIds.length > 0 ? (
            <form action={action} className="print:hidden">
              {orderRequestIds.map((id) => <input key={id} type="hidden" name="orderRequestId" value={id} />)}
              <button type="submit" disabled={pending}
                className="min-h-10 rounded btn-secondary px-3 text-sm font-semibold transition disabled:cursor-not-allowed">
                {pending ? "確認中" : `${orderRequestIds.length}件をまとめて発注予定へ`}
              </button>
            </form>
          ) : null}
        </div>
      </div>
      {orderRequestIds.length > 0 ? children : null}
    </section>
  );
}
