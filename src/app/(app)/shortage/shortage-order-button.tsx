"use client";

import { useActionState } from "react";
import { createOrderRequestWithStateAction, type OrderActionState } from "@/lib/actions/orders";

const initialState: OrderActionState = {};

type ShortageOrderButtonProps = {
  stockItemId: string;
  isAlreadyAdded: boolean;
  pendingQuantity?: number;
};

export function ShortageOrderButton({ stockItemId, isAlreadyAdded, pendingQuantity = 0 }: ShortageOrderButtonProps) {
  const [state, formAction, isPending] = useActionState(createOrderRequestWithStateAction, initialState);
  const isDisabled = isAlreadyAdded || isPending;
  const hasPendingOrder = pendingQuantity > 0;

  return (
    <form action={formAction} className="grid gap-2 print:hidden">
      <input type="hidden" name="stockItemId" value={stockItemId} />
      <button
        type="submit"
        disabled={isDisabled}
        className="h-9 rounded btn-primary px-3 text-xs font-semibold transition disabled:cursor-not-allowed"
      >
        {hasPendingOrder ? "納品待ちあり" : isAlreadyAdded ? "追加済み" : isPending ? "追加中" : "候補へ追加"}
      </button>
      {hasPendingOrder ? (
        <p className="rounded border border-line border-l-4 border-l-ink bg-markSoft px-2 py-1 text-xs font-semibold text-ink">
          発注済 {pendingQuantity}個があります
        </p>
      ) : null}
      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "rounded bg-panel px-2 py-1 text-xs font-semibold text-accent"
              : "rounded bg-panel px-2 py-1 text-xs font-semibold text-danger"
          }
        >
          {state.status === "success" ? "✓ " : state.message.startsWith("エラー") ? "" : "エラー: "}{state.message}
        </p>
      ) : null}
    </form>
  );
}
