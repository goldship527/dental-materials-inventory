"use client";

import { useActionState, useMemo, useState } from "react";
import {
  updatePurchaseHistorySetupAction,
  type PurchaseHistorySetupActionState,
} from "@/lib/actions/purchase-history-setup";
import type { PurchaseHistorySetupProductRow } from "@/lib/db/products";

type PurchaseHistorySetupFormProps = {
  products: PurchaseHistorySetupProductRow[];
  categories: string[];
};

const initialState: PurchaseHistorySetupActionState = {};

export function PurchaseHistorySetupForm({ products, categories }: PurchaseHistorySetupFormProps) {
  const [rows, setRows] = useState(() =>
    products.map((product) => ({
      productId: product.id,
      category: product.category && product.category !== "未分類" ? product.category : "",
      defaultMinStock: product.defaultMinStock,
    })),
  );
  const [state, action, isPending] = useActionState(updatePurchaseHistorySetupAction, initialState);
  const itemsJson = useMemo(() => JSON.stringify(rows), [rows]);

  function updateRow(productId: string, changes: Partial<(typeof rows)[number]>) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.productId === productId ? { ...row, ...changes } : row)),
    );
  }

  if (products.length === 0) {
    return (
      <section className="rounded border border-line bg-white p-6 text-sm shadow-panel">
        <p className="font-semibold text-ink">まとめて整える商品はありません。</p>
        <p className="mt-2 text-muted">購入履歴から登録した商品で、カテゴリや最低在庫の確認が必要なものは見つかりませんでした。</p>
        <a className="mt-4 inline-flex rounded border border-line px-4 py-2 font-semibold text-muted transition hover:border-accent hover:text-accent" href="/products?source=purchase-history">
          購入履歴から登録した商品を見る
        </a>
      </section>
    );
  }

  return (
    <section className="rounded border border-line bg-white p-5 shadow-panel">
      <form action={action} className="grid gap-5">
        <input type="hidden" name="items" value={itemsJson} />

        <div className="rounded border border-orange-200 bg-orange-50 px-4 py-3 text-sm leading-6 text-warning">
          ここではカテゴリと最低在庫だけをまとめて更新します。在庫数、保管場所、購入金額は変更しません。
        </div>

        {state.message ? (
          <p
            className={
              state.status === "success"
                ? "rounded border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-success"
                : "rounded border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-danger"
            }
          >
            {state.message}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-gray-50 text-xs text-muted">
              <tr>
                <th className="border-b border-line px-3 py-2">商品</th>
                <th className="border-b border-line px-3 py-2">メーカー・規格</th>
                <th className="border-b border-line px-3 py-2">カテゴリ</th>
                <th className="border-b border-line px-3 py-2">最低在庫</th>
                <th className="border-b border-line px-3 py-2">詳細</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const row = rows.find((item) => item.productId === product.id);

                return (
                  <tr key={product.id} className="align-top">
                    <td className="border-b border-line px-3 py-3">
                      <p className="font-semibold text-ink">{product.name}</p>
                      <p className="mt-1 text-xs text-muted">
                        {product.productCode ?? "コード未設定"} / JAN {product.janCode ?? "-"}
                      </p>
                    </td>
                    <td className="border-b border-line px-3 py-3">
                      <p>{product.manufacturer ?? "-"}</p>
                      <p className="mt-1 text-xs text-muted">{product.specification ?? "-"}</p>
                    </td>
                    <td className="border-b border-line px-3 py-3">
                      <input
                        list="purchase-history-setup-categories"
                        value={row?.category ?? ""}
                        onChange={(event) => updateRow(product.id, { category: event.target.value })}
                        placeholder="例: 印象材"
                        className="h-11 w-full rounded border border-line px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                      />
                    </td>
                    <td className="border-b border-line px-3 py-3">
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        value={row?.defaultMinStock ?? 0}
                        onChange={(event) => updateRow(product.id, { defaultMinStock: Number(event.target.value) })}
                        className="h-11 w-28 rounded border border-line px-3 text-right text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                      />
                    </td>
                    <td className="border-b border-line px-3 py-3">
                      <a className="font-semibold text-accent hover:underline" href={`/products/${product.id}/edit`}>
                        個別編集
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <datalist id="purchase-history-setup-categories">
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "保存中" : "まとめて保存"}
          </button>
          <a
            className="rounded border border-line px-5 py-3 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
            href="/products?source=purchase-history&setup=1"
          >
            商品一覧で確認
          </a>
        </div>
      </form>
    </section>
  );
}
