"use client";

import { useActionState, useState } from "react";
import { quickMoveWithStateAction, type StockActionState } from "@/lib/actions/stock";
import type { StockRow } from "@/lib/db/stock";
import { buildProductPhotoUrl } from "@/lib/product-photos/url";

const initialState: StockActionState = {};

type QuickCardProps = {
  categoryLabel: string;
  row: StockRow;
  selectedStaffOperatorId: string;
};

export function QuickCard({ categoryLabel, row, selectedStaffOperatorId }: QuickCardProps) {
  const [state, formAction, isPending] = useActionState(quickMoveWithStateAction, initialState);
  const [pendingDelta, setPendingDelta] = useState<"-1" | "+1" | null>(null);
  const isStaffSelected = selectedStaffOperatorId.length > 0;
  const photoUrl = buildProductPhotoUrl({
    id: row.productId,
    photoUpdatedAt: row.photoUpdatedAt,
  });

  return (
    <article className="grid gap-2 rounded border border-line/90 bg-panel p-3 shadow-panel transition hover:border-accent/40 hover:bg-white">
      <div className="grid grid-cols-[56px_1fr] gap-3">
        {photoUrl ? (
          <img alt={`${row.name}の商品写真`} className="aspect-square rounded border border-line object-cover" src={photoUrl} />
        ) : (
          <div className="grid aspect-square place-items-center rounded border border-dashed border-line bg-subtle text-[10px] font-semibold text-muted">
            写真なし
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-accent">{categoryLabel}</p>
          <h2 className="mt-1.5 text-base font-semibold leading-5">
            <a className="text-accent hover:underline" href={`/products/${row.productId}`}>
              {row.name}
            </a>
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded bg-subtle/70 px-3 py-2">
        <div>
          <p className="text-[11px] font-semibold text-muted">現在庫</p>
          <p className="mt-0.5 text-3xl font-bold leading-none tabular-nums">{row.quantity}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-muted">最低</p>
          <p className="mt-0.5 text-2xl font-bold leading-none tabular-nums">{row.minStock}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-muted">保管</p>
          <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-4 text-ink">
            {row.location ?? "未設定"}
          </p>
        </div>
      </div>
      {row.stockStatus !== "ENOUGH" ? (
        <span className={`inline-flex w-fit rounded px-2 py-1 text-xs font-semibold ${row.stockStatusClassName}`}>
          {row.stockStatusLabel}
        </span>
      ) : null}
      <div className="grid grid-cols-[1.25fr_1fr] gap-2">
        <form action={formAction} onSubmit={() => setPendingDelta("-1")}>
          <input type="hidden" name="stockItemId" value={row.stockItemId} />
          <input type="hidden" name="delta" value="-1" />
          <input type="hidden" name="staffOperatorId" value={selectedStaffOperatorId} />
          <button
            type="submit"
            disabled={row.quantity <= 0 || !isStaffSelected || isPending}
            className="h-11 w-full rounded border border-red-200 bg-red-50 text-2xl font-semibold text-danger transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending && pendingDelta === "-1" ? "出庫中" : "-1"}
          </button>
        </form>
        <form action={formAction} onSubmit={() => setPendingDelta("+1")}>
          <input type="hidden" name="stockItemId" value={row.stockItemId} />
          <input type="hidden" name="delta" value="1" />
          <input type="hidden" name="staffOperatorId" value={selectedStaffOperatorId} />
          <button
            type="submit"
            disabled={!isStaffSelected || isPending}
            className="h-11 w-full rounded border border-line bg-white text-xl font-semibold text-accent transition hover:border-accent hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending && pendingDelta === "+1" ? "入庫中" : "+1"}
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
