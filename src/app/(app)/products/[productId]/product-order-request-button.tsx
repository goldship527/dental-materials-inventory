"use client";

import { useActionState } from "react";
import { createOrderRequestWithStateAction, type OrderActionState } from "@/lib/actions/orders";

const initialState: OrderActionState = {};

type ProductOrderRequestButtonProps = {
  stockItemId: string;
  isAlreadyAdded: boolean;
  hasPendingOrder: boolean;
};

export function ProductOrderRequestButton({
  stockItemId,
  isAlreadyAdded,
  hasPendingOrder,
}: ProductOrderRequestButtonProps) {
  const [state, formAction, isPending] = useActionState(createOrderRequestWithStateAction, initialState);
  const isDisabled = isAlreadyAdded || hasPendingOrder || isPending;

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="stockItemId" value={stockItemId} />
      <button
        type="submit"
        disabled={isDisabled}
        className="rounded btn-primary px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed"
      >
        {hasPendingOrder
          ? "納品待ちあり"
          : isAlreadyAdded
            ? "発注候補に追加済み"
            : isPending
              ? "追加中"
              : "発注候補へ追加"}
      </button>
      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "rounded bg-panel px-3 py-2 text-xs font-semibold text-accent"
              : "rounded bg-panel px-3 py-2 text-xs font-semibold text-danger"
          }
        >
          {state.status === "success" ? "✓ " : state.message.startsWith("エラー") ? "" : "エラー: "}{state.message}
        </p>
      ) : null}
    </form>
  );
}
