"use client";

import { useActionState } from "react";
import { updateSupplierMasterWithStateAction, type SupplierMasterActionState } from "@/lib/actions/suppliers";
import type { SupplierDetail } from "@/lib/db/suppliers";

type SupplierEditFormProps = {
  supplier: SupplierDetail;
};

const initialState: SupplierMasterActionState = {};

export function SupplierEditForm({ supplier }: SupplierEditFormProps) {
  const [state, formAction, isPending] = useActionState(updateSupplierMasterWithStateAction, initialState);

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="supplierId" value={supplier.id} />

      <section className="rounded border border-line bg-white p-5 shadow-panel">
        <h2 className="text-lg font-semibold">基本情報</h2>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1 text-sm font-semibold text-muted">
            発注先名
            <input
              name="name"
              defaultValue={supplier.name}
              required
              maxLength={100}
              className="h-11 rounded border border-line px-3 text-base font-semibold text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-muted">
          フェーズ3-Aでは発注先名だけを編集します。住所、電話番号、メールアドレス、外部送信情報はまだ扱いません。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded border border-line bg-white p-5 shadow-panel">
          <p className="text-sm font-semibold text-muted">取扱商品</p>
          <p className="mt-2 text-3xl font-semibold">{supplier.productCount}</p>
        </div>
        <div className="rounded border border-line bg-white p-5 shadow-panel">
          <p className="text-sm font-semibold text-muted">不足あり</p>
          <p className={supplier.shortageProductCount > 0 ? "mt-2 text-3xl font-semibold text-danger" : "mt-2 text-3xl font-semibold"}>
            {supplier.shortageProductCount}
          </p>
        </div>
        <div className="rounded border border-line bg-white p-5 shadow-panel">
          <p className="text-sm font-semibold text-muted">未確認候補</p>
          <p className="mt-2 text-3xl font-semibold">{supplier.orderRequestCounts.DRAFT}</p>
        </div>
      </section>

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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "保存中" : "保存する"}
        </button>
        <a
          className="rounded border border-line bg-white px-5 py-3 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
          href={`/suppliers/${supplier.id}`}
        >
          詳細へ戻る
        </a>
      </div>
    </form>
  );
}
