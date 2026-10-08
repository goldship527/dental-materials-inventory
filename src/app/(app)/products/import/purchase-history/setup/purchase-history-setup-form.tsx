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
      <section className="rounded border border-line bg-panel p-6 text-sm shadow-sheet">
        <p className="font-semibold text-ink">まとめて整える商品はありません。</p>
        <p className="mt-2 text-muted">購入履歴から登録した商品で、カテゴリや最低在庫の確認が必要なものは見つかりませんでした。</p>
        <a className="mt-4 inline-flex rounded btn-secondary px-4 py-2 font-semibold transition" href="/products?source=purchase-history">
          購入履歴から登録した商品を見る
        </a>
      </section>
    );
  }

  return (
    <section className="rounded border border-line bg-panel p-5 shadow-sheet">
      <form action={action} className="grid gap-5">
        <input type="hidden" name="items" value={itemsJson} />

        <div className="rounded border border-line border-l-4 border-l-ink bg-markSoft px-4 py-3 text-sm leading-6 text-ink">
          ここではカテゴリと最低在庫だけをまとめて更新します。在庫数、保管場所、購入金額は変更しません。
        </div>

        {state.message ? (
          <p
            className={
              state.status === "success"
                ? "rounded border border-line bg-panel px-4 py-3 text-sm font-semibold text-success"
                : "rounded border border-line border-l-4 border-l-danger bg-panel px-4 py-3 text-sm font-semibold text-danger"
            }
          >
            {state.status === "success" ? "✓ " : state.message.startsWith("エラー") ? "" : "エラー: "}{state.message}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-tint text-label text-accent">
              <tr>
                <th className="border-b border-accent px-3 py-2">商品</th>
                <th className="border-b border-accent px-3 py-2">メーカー・規格</th>
                <th className="border-b border-accent px-3 py-2">カテゴリ</th>
                <th className="border-b border-accent px-3 py-2">最低在庫</th>
                <th className="border-b border-accent px-3 py-2">詳細</th>
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
                        {product.productCode ?? "コード未設定"}
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
                        className="h-11 w-full rounded border border-line px-3 text-sm    "
                      />
                    </td>
                    <td className="border-b border-line px-3 py-3">
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        value={row?.defaultMinStock ?? 0}
                        onChange={(event) => updateRow(product.id, { defaultMinStock: Number(event.target.value) })}
                        className="h-11 w-28 rounded border border-line px-3 text-right text-sm    "
                      />
                      {product.recommendedMinStock?.recommended !== null && product.recommendedMinStock?.recommended !== undefined ? (
                        <button
                          type="button"
                          onClick={() => updateRow(product.id, { defaultMinStock: product.recommendedMinStock?.recommended ?? 0 })}
                          className="mt-2 rounded btn-secondary px-3 py-2 text-xs font-semibold transition"
                        >
                          推奨 {product.recommendedMinStock.recommended}
                        </button>
                      ) : (
                        <p className="mt-2 text-xs text-muted">推奨: データ不足</p>
                      )}
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
            className="rounded btn-primary px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
          >
            {isPending ? "保存中" : "まとめて保存"}
          </button>
          <a
            className="rounded btn-secondary px-5 py-3 text-sm font-semibold transition"
            href="/products?source=purchase-history&setup=1"
          >
            商品一覧で確認
          </a>
        </div>
      </form>
    </section>
  );
}
