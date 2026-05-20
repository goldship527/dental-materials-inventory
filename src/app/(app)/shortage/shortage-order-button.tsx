"use client";

import { useActionState } from "react";
import { createOrderRequestWithStateAction, type OrderActionState } from "@/lib/actions/orders";

const initialState: OrderActionState = {};

type ShortageOrderButtonProps = {
  stockItemId: string;
  isAlreadyAdded: boolean;
};

export function ShortageOrderButton({ stockItemId, isAlreadyAdded }: ShortageOrderButtonProps) {
  const [state, formAction, isPending] = useActionState(createOrderRequestWithStateAction, initialState);
  const isDisabled = isAlreadyAdded || isPending;

  return (
    <form action={formAction} className="grid gap-2 print:hidden">
      <input type="hidden" name="stockItemId" value={stockItemId} />
      <button
        type="submit"
        disabled={isDisabled}
        className="h-9 rounded bg-accent px-3 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-muted"
      >
        {isAlreadyAdded ? "追加済み" : isPending ? "追加中" : "候補へ追加"}
      </button>
      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-accent"
              : "rounded bg-red-50 px-2 py-1 text-xs font-semibold text-danger"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
