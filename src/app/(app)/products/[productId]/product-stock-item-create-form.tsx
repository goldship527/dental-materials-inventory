"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createStockItemWithStateAction, type StockActionState } from "@/lib/actions/stock";

type ProductStockItemCreateFormProps = {
  productId: string;
  defaultMinStock: number;
};

type StockItemFieldName = "quantity" | "minStock" | "location";

const initialState: StockActionState = {};

export function ProductStockItemCreateForm({ productId, defaultMinStock }: ProductStockItemCreateFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createStockItemWithStateAction, initialState);
  const getFieldError = (fieldName: StockItemFieldName) => state.fieldErrors?.[fieldName];
  const controlClass = (fieldName: StockItemFieldName, className = "") => {
    const hasError = Boolean(getFieldError(fieldName));

    return [
      "rounded border px-3 text-ink outline-none focus:ring-2",
      hasError ? "border-danger focus:border-danger focus:ring-danger/20" : "border-line focus:border-accent focus:ring-accent/20",
      className,
    ]
      .filter(Boolean)
      .join(" ");
  };
  const fieldError = (fieldName: StockItemFieldName) => {
    const message = getFieldError(fieldName);

    return message ? <p className="text-xs font-semibold text-danger">{message}</p> : null;
  };

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form action={formAction} noValidate className="mt-4 grid gap-4 rounded border border-dashed border-accent/40 bg-emerald-50/30 p-4">
      <input type="hidden" name="productId" value={productId} />
      <div>
        <h3 className="text-sm font-semibold text-ink">このクリニックの在庫一覧に追加</h3>
        <p className="mt-1 text-sm text-muted">
          初期在庫数と最低在庫を設定すると、在庫一覧、棚卸、不足確認の対象になります。
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold text-muted">
          初期在庫数
          <input
            type="number"
            name="quantity"
            defaultValue="0"
            min="0"
            max="9999"
            required
            inputMode="numeric"
            aria-invalid={Boolean(getFieldError("quantity"))}
            className={controlClass("quantity", "h-11 text-right")}
          />
          {fieldError("quantity")}
        </label>

        <label className="grid gap-1 text-sm font-semibold text-muted">
          最低在庫
          <input
            type="number"
            name="minStock"
            defaultValue={defaultMinStock}
            min="0"
            max="9999"
            required
            inputMode="numeric"
            aria-invalid={Boolean(getFieldError("minStock"))}
            className={controlClass("minStock", "h-11 text-right")}
          />
          {fieldError("minStock")}
        </label>

        <label className="grid gap-1 text-sm font-semibold text-muted">
          保管場所
          <input
            name="location"
            maxLength={100}
            aria-invalid={Boolean(getFieldError("location"))}
            className={controlClass("location", "h-11")}
          />
          {fieldError("location")}
        </label>
      </div>

      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "rounded border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-accent"
              : "rounded border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-danger"
          }
        >
          {state.message}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "追加中" : "在庫一覧に追加"}
        </button>
      </div>
    </form>
  );
}
