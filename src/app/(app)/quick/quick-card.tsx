"use client";

import { useActionState } from "react";
import { quickMoveWithStateAction, type StockActionState } from "@/lib/actions/stock";
import type { StockRow } from "@/lib/db/stock";
import { buildProductPhotoUrl } from "@/lib/product-photos/url";

const initialState: StockActionState = {};

type QuickCardProps = {
  categoryLabel: string;
  row: StockRow;
};

export function QuickCard({ categoryLabel, row }: QuickCardProps) {
  const [state, formAction, isPending] = useActionState(quickMoveWithStateAction, initialState);
  const photoUrl = buildProductPhotoUrl({
    id: row.productId,
    photoUpdatedAt: row.photoUpdatedAt,
  });

  return (
    <article className="grid min-h-52 gap-3 rounded border border-line/90 bg-panel p-4 shadow-panel transition hover:border-accent/40 hover:bg-white">
      <div className="grid grid-cols-[64px_1fr] gap-3">
        {photoUrl ? (
          <img alt={`${row.name}の商品写真`} className="aspect-square rounded border border-line object-cover" src={photoUrl} />
        ) : (
          <div className="grid aspect-square place-items-center rounded border border-dashed border-line bg-subtle text-[10px] font-semibold text-muted">
            写真なし
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-accent">{categoryLabel}</p>
          <h2 className="mt-2 text-lg font-semibold leading-6">
            <a className="text-accent hover:underline" href={`/products/${row.productId}`}>
              {row.name}
            </a>
          </h2>
          <p className="mt-2 text-xs text-muted">
            最低 {row.minStock} / {row.location ?? "保管場所未設定"}
          </p>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted">現在庫</p>
          <p className="text-4xl font-bold tabular-nums">{row.quantity}</p>
        </div>
        {row.stockStatus !== "ENOUGH" ? (
          <span className={`rounded px-2 py-1 text-xs font-semibold ${row.stockStatusClassName}`}>
            {row.stockStatusLabel}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <form action={formAction}>
          <input type="hidden" name="stockItemId" value={row.stockItemId} />
          <input type="hidden" name="delta" value="-1" />
          <button
            type="submit"
            disabled={row.quantity <= 0 || isPending}
            className="h-12 w-full rounded bg-danger text-2xl font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "..." : "-1"}
          </button>
        </form>
        <form action={formAction}>
          <input type="hidden" name="stockItemId" value={row.stockItemId} />
          <input type="hidden" name="delta" value="1" />
          <button
            type="submit"
            disabled={isPending}
            className="h-12 w-full rounded border border-line bg-white text-2xl font-semibold text-accent transition hover:border-accent hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "..." : "+1"}
          </button>
        </form>
      </div>
      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "rounded bg-green-50 px-3 py-2 text-xs font-semibold text-success"
              : "rounded bg-red-50 px-3 py-2 text-xs font-semibold text-danger"
          }
        >
          {state.message}
        </p>
      ) : null}
    </article>
  );
}
