"use client";

import { useActionState, useState } from "react";
import { adjustStockWithStateAction, type StockActionState } from "@/lib/actions/stock";
import type { StockRow } from "@/lib/db/stock";

type StocktakeFormProps = {
  rows: StockRow[];
};

const initialState: StockActionState = {};

type StocktakeRowProps = {
  row: StockRow;
};

function StocktakeRow({ row }: StocktakeRowProps) {
  const [state, formAction, isPending] = useActionState(adjustStockWithStateAction, initialState);
  const [actualValue, setActualValue] = useState("");
  const actualQuantity = actualValue === "" ? null : Number(actualValue);
  const difference = actualQuantity === null || Number.isNaN(actualQuantity) ? null : actualQuantity - row.quantity;
  const formId = `stocktake-${row.stockItemId}`;

  return (
    <tr className="align-top">
      <td className="border-b border-line px-4 py-3">
        <a className="font-semibold text-accent hover:underline" href={`/products/${row.productId}`}>
          {row.name}
        </a>
        <p className="mt-1 text-xs text-muted">{row.category ?? "未分類"}</p>
        {state.message ? (
          <p
            className={
              state.status === "success"
                ? "mt-2 rounded bg-emerald-50 px-3 py-2 text-xs font-semibold text-accent"
                : "mt-2 rounded bg-red-50 px-3 py-2 text-xs font-semibold text-danger"
            }
          >
            {state.message}
          </p>
        ) : null}
      </td>
      <td className="border-b border-line px-4 py-3">{row.location ?? "-"}</td>
      <td className="border-b border-line px-4 py-3 text-right text-lg font-semibold">{row.quantity}</td>
      <td className="border-b border-line px-4 py-3 text-right">
        <form id={formId} action={formAction}>
          <input type="hidden" name="stockItemId" value={row.stockItemId} />
          <input type="hidden" name="reason" value="棚卸確定" />
          <input type="hidden" name="sourceType" value="STOCKTAKE" />
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            name="quantity"
            value={actualValue}
            onChange={(event) => setActualValue(event.target.value)}
            className="h-10 w-28 rounded border border-line px-3 text-right outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </form>
      </td>
      <td className="border-b border-line px-4 py-3 text-right">
        {difference === null ? (
          <span className="text-muted">-</span>
        ) : difference === 0 ? (
          <span className="font-semibold text-accent">差異なし</span>
        ) : (
          <span className={difference > 0 ? "font-semibold text-accent" : "font-semibold text-danger"}>
            {difference > 0 ? "+" : ""}
            {difference}
          </span>
        )}
      </td>
      <td className="border-b border-line px-4 py-3">
        <button
          type="submit"
          form={formId}
          disabled={isPending || difference === null || difference === 0}
          className="h-10 rounded bg-ink px-4 text-xs font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "確定中" : "確定"}
        </button>
      </td>
    </tr>
  );
}

export function StocktakeForm({ rows }: StocktakeFormProps) {
  return (
    <section className="overflow-hidden rounded border border-line bg-white shadow-panel">
      <div className="border-b border-line px-4 py-3 text-sm text-muted">
        実在庫を入力すると、システム在庫との差異が表示されます。
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-gray-50 text-xs text-muted">
            <tr>
              <th className="border-b border-line px-4 py-3">商品</th>
              <th className="border-b border-line px-4 py-3">保管場所</th>
              <th className="border-b border-line px-4 py-3 text-right">システム在庫</th>
              <th className="border-b border-line px-4 py-3 text-right">実在庫</th>
              <th className="border-b border-line px-4 py-3 text-right">差異</th>
              <th className="border-b border-line px-4 py-3">確定</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => <StocktakeRow key={row.stockItemId} row={row} />)
            ) : (
              <tr>
                <td className="px-4 py-12 text-center text-muted" colSpan={6}>
                  条件に一致する商品はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
