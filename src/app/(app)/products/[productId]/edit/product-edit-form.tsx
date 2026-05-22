"use client";

import { useActionState } from "react";
import { updateProductMasterWithStateAction, type ProductMasterActionState } from "@/lib/actions/products";
import type { ProductDetail } from "@/lib/db/products";

type SupplierOption = {
  id: string;
  name: string;
};

type ProductEditFormProps = {
  product: ProductDetail;
  suppliers: SupplierOption[];
};

const initialState: ProductMasterActionState = {};

function valueOrEmpty(value: string | number | null) {
  return value === null ? "" : String(value);
}

export function ProductEditForm({ product, suppliers }: ProductEditFormProps) {
  const [state, formAction, isPending] = useActionState(updateProductMasterWithStateAction, initialState);
  const alternativeProductSuppliers = product.productSuppliers.filter((productSupplier) => !productSupplier.isPrimary);

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="productId" value={product.id} />

      <section className="rounded border border-line bg-white p-5 shadow-panel">
        <h2 className="text-lg font-semibold">基本情報</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-muted md:col-span-2">
            商品名
            <input
              name="name"
              defaultValue={product.name}
              required
              maxLength={100}
              className="h-11 rounded border border-line px-3 text-base font-semibold text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            商品コード
            <input
              name="productCode"
              defaultValue={valueOrEmpty(product.productCode)}
              maxLength={100}
              className="h-11 rounded border border-line px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            JANコード
            <input
              name="janCode"
              defaultValue={valueOrEmpty(product.janCode)}
              inputMode="numeric"
              maxLength={100}
              className="h-11 rounded border border-line px-3 font-mono text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            カテゴリ
            <input
              name="category"
              defaultValue={valueOrEmpty(product.category)}
              maxLength={100}
              className="h-11 rounded border border-line px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            メーカー
            <input
              name="manufacturer"
              defaultValue={valueOrEmpty(product.manufacturer)}
              maxLength={100}
              className="h-11 rounded border border-line px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            規格
            <input
              name="specification"
              defaultValue={valueOrEmpty(product.specification)}
              maxLength={100}
              className="h-11 rounded border border-line px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            発注単位
            <input
              name="orderUnit"
              defaultValue={valueOrEmpty(product.orderUnit)}
              maxLength={100}
              className="h-11 rounded border border-line px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
        </div>
        <div className="mt-6 border-t border-line pt-5">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-ink">代替発注先</h3>
            <p className="text-xs text-muted">
              主発注先以外でも購入できる発注先を、必要な分だけ登録します。発注先は自動では切り替わりません。
            </p>
          </div>
          <div className="mt-4 grid gap-4">
            {[0, 1].map((index) => {
              const productSupplier = alternativeProductSuppliers[index];

              return (
                <div key={index} className="grid gap-3 rounded border border-line bg-gray-50 p-4 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-semibold text-muted md:col-span-2">
                    代替発注先 {index + 1}
                    <select
                      name="alternativeSupplierId"
                      defaultValue={productSupplier?.supplierId ?? ""}
                      className="h-11 rounded border border-line bg-white px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    >
                      <option value="">未設定</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-muted">
                    発注先品番
                    <input
                      name="alternativeSupplierProductCode"
                      defaultValue={valueOrEmpty(productSupplier?.supplierProductCode ?? null)}
                      maxLength={100}
                      className="h-11 rounded border border-line bg-white px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-muted">
                    発注単位
                    <input
                      name="alternativeOrderUnit"
                      defaultValue={valueOrEmpty(productSupplier?.orderUnit ?? null)}
                      maxLength={100}
                      className="h-11 rounded border border-line bg-white px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-muted">
                    標準価格
                    <input
                      type="number"
                      name="alternativeStandardPrice"
                      defaultValue={valueOrEmpty(productSupplier?.standardPrice ?? null)}
                      min="0"
                      max="9999999"
                      step="1"
                      inputMode="numeric"
                      className="h-11 rounded border border-line bg-white px-3 text-right text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-muted">
                    備考
                    <input
                      name="alternativeNotes"
                      defaultValue={valueOrEmpty(productSupplier?.notes ?? null)}
                      maxLength={500}
                      className="h-11 rounded border border-line bg-white px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded border border-line bg-white p-5 shadow-panel">
        <h2 className="text-lg font-semibold">発注・在庫判断</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-muted">
            主発注先
            <select
              name="primarySupplierId"
              defaultValue={product.primarySupplierId ?? ""}
              className="h-11 rounded border border-line bg-white px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="">未設定</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            発注先側の商品コード
            <input
              name="supplierProductCode"
              defaultValue={valueOrEmpty(product.supplierProductCode)}
              maxLength={100}
              className="h-11 rounded border border-line px-3 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            標準価格
            <input
              type="number"
              name="standardPrice"
              defaultValue={valueOrEmpty(product.standardPrice)}
              min="0"
              max="9999999"
              step="1"
              inputMode="numeric"
              className="h-11 rounded border border-line px-3 text-right text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            標準の最低在庫
            <input
              type="number"
              name="defaultMinStock"
              defaultValue={product.defaultMinStock}
              min="0"
              max="9999"
              required
              inputMode="numeric"
              className="h-11 rounded border border-line px-3 text-right text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
        </div>
      </section>

      <section className="rounded border border-line bg-white p-5 shadow-panel">
        <label className="grid gap-1 text-sm font-semibold text-muted">
          備考
          <textarea
            name="notes"
            defaultValue={valueOrEmpty(product.notes)}
            maxLength={500}
            className="min-h-28 rounded border border-line px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <p className="mt-3 text-xs text-muted">個人情報や秘密情報は入力しないでください。</p>
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
          href={`/products/${product.id}`}
        >
          詳細へ戻る
        </a>
      </div>
    </form>
  );
}
