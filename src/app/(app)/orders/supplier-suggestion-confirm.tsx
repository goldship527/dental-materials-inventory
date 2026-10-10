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
      <div className="flex flex-col gap-2 border-b-2 border-ink bg-markSoft px-4 py-3 sm:flex-row sm:items-start sm:justify-between print:border-ink print:bg-panel print:px-2 print:py-1.5 print:text-xs">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-mark text-base font-bold text-ink print:hidden">1</span>
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-ink print:text-xs">
              確認待ち
              <span className="rounded border border-line bg-panel/80 px-2 py-0.5 text-label font-semibold text-muted print:border-ink print:text-ink">{orderRequestIds.length} 件</span>
            </h3>
            <p className="mt-0.5 text-sm text-ink print:hidden">自動で計算した数量を確かめて、発注予定へ移します。</p>
            <p className="hidden print:block print:text-ink">在庫変動から自動計算・スタッフ確認待ち</p>
            {state.message ? (
              <p role="status" aria-live="polite"
                className={state.status === "error" ? "mt-2 text-sm font-semibold text-danger print:hidden" : "mt-2 text-sm font-semibold text-success print:hidden"}>
                {state.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2 sm:justify-end">
          {orderRequestIds.length > 0 ? (
            <form action={action} className="w-full print:hidden sm:w-auto">
              {orderRequestIds.map((id) => <input key={id} type="hidden" name="orderRequestId" value={id} />)}
              <button type="submit" disabled={pending}
                className="min-h-11 w-full rounded btn-primary px-3 text-base font-semibold transition disabled:cursor-not-allowed">
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
