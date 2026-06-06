"use client";

import { useState } from "react";
import { markOrderRequestsOrderedAction } from "@/lib/actions/orders";
import { orderSendMethodLabels, orderSendMethodValues } from "@/lib/orders/send-method";

type SupplierOrderRecordPanelProps = {
  orderRequestIds: string[];
  printHref: string;
};

export function SupplierOrderRecordPanel({ orderRequestIds, printHref }: SupplierOrderRecordPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (orderRequestIds.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2 print:hidden">
      <div className="flex flex-wrap justify-end gap-2">
        <a
          className="inline-flex min-h-9 items-center justify-center rounded border border-accent/30 bg-white px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-teal-50"
          href={printHref}
        >
          このディーラーだけ印刷
        </a>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="inline-flex min-h-9 items-center justify-center rounded bg-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
        >
          {isOpen ? "入力を閉じる" : "発注済みにする"}
        </button>
      </div>

      {isOpen ? (
        <form action={markOrderRequestsOrderedAction} className="grid gap-2 rounded border border-line bg-white/90 p-3">
          {orderRequestIds.map((orderRequestId) => (
            <input key={orderRequestId} type="hidden" name="orderRequestId" value={orderRequestId} />
          ))}
          <p className="text-xs font-semibold text-muted">
            このディーラーの発注予定を納品待ちに移します。外部送信は行いません。
          </p>
          <div className="grid gap-2 lg:grid-cols-[auto_12rem_1fr_1fr_auto] lg:items-end">
            <label className="flex h-9 items-center gap-2 whitespace-nowrap text-xs font-semibold text-muted">
              <input type="checkbox" name="confirmOrdered" required className="h-4 w-4 accent-teal-700" />
              送付済み確認
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted">
              送付方法
              <select
                name="orderedMethod"
                required
                defaultValue=""
                className="h-9 rounded border border-line bg-white px-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value="" disabled>
                  選択してください
                </option>
                {orderSendMethodValues.map((method) => (
                  <option key={method} value={method}>
                    {orderSendMethodLabels[method]}
                  </option>
                ))}
              </select>
            </label>
            <textarea
              name="orderedMemo"
              placeholder="送付メモ（任意）"
              maxLength={300}
              className="h-9 min-h-9 rounded border border-line bg-white px-2 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <textarea
              name="supplierResponseMemo"
              placeholder="先方対応メモ（任意）"
              maxLength={300}
              className="h-9 min-h-9 rounded border border-line bg-white px-2 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="submit"
              className="h-9 rounded bg-ink px-3 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              納品待ちへ移す
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
