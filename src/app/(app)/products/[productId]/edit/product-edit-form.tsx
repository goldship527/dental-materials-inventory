"use client";

import { useActionState, useRef } from "react";
import {
  updateProductMasterWithStateAction,
  type ProductMasterActionState,
  type ProductMasterFieldName,
} from "@/lib/actions/products";
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
  const defaultMinStockInputRef = useRef<HTMLInputElement | null>(null);
  const alternativeProductSuppliers = product.productSuppliers.filter((productSupplier) => !productSupplier.isPrimary);
  const getFieldError = (fieldName: ProductMasterFieldName) => state.fieldErrors?.[fieldName];
  const controlClass = (fieldName: ProductMasterFieldName, className = "") => {
    const hasError = Boolean(getFieldError(fieldName));

    return [
      "rounded border px-3 text-ink outline-none focus:ring-2",
      hasError ? "border-danger focus:border-danger focus:ring-danger/20" : "border-line focus:border-accent focus:ring-accent/20",
      className,
    ]
      .filter(Boolean)
      .join(" ");
  };
  const fieldError = (fieldName: ProductMasterFieldName) => {
    const message = getFieldError(fieldName);

    return message ? <p className="text-xs font-semibold text-danger">{message}</p> : null;
  };

  return (
    <form action={formAction} noValidate className="grid gap-6">
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
              aria-invalid={Boolean(getFieldError("name"))}
              className={controlClass("name", "h-11 text-base font-semibold")}
            />
            {fieldError("name")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            商品コード
            <input
              name="productCode"
              defaultValue={valueOrEmpty(product.productCode)}
              maxLength={100}
              aria-invalid={Boolean(getFieldError("productCode"))}
              className={controlClass("productCode", "h-11")}
            />
            {fieldError("productCode")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            JANコード
            <input
              name="janCode"
              defaultValue={valueOrEmpty(product.janCode)}
              inputMode="numeric"
              maxLength={100}
              aria-invalid={Boolean(getFieldError("janCode"))}
              className={controlClass("janCode", "h-11 font-mono")}
            />
            {fieldError("janCode")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            カテゴリ
            <input
              name="category"
              defaultValue={valueOrEmpty(product.category)}
              maxLength={100}
              aria-invalid={Boolean(getFieldError("category"))}
              className={controlClass("category", "h-11")}
            />
            {fieldError("category")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            メーカー
            <input
              name="manufacturer"
              defaultValue={valueOrEmpty(product.manufacturer)}
              maxLength={100}
              aria-invalid={Boolean(getFieldError("manufacturer"))}
              className={controlClass("manufacturer", "h-11")}
            />
            {fieldError("manufacturer")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            規格
            <input
              name="specification"
              defaultValue={valueOrEmpty(product.specification)}
              maxLength={100}
              aria-invalid={Boolean(getFieldError("specification"))}
              className={controlClass("specification", "h-11")}
            />
            {fieldError("specification")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            発注単位
            <input
              name="orderUnit"
              defaultValue={valueOrEmpty(product.orderUnit)}
              maxLength={100}
              aria-invalid={Boolean(getFieldError("orderUnit"))}
              className={controlClass("orderUnit", "h-11")}
            />
            {fieldError("orderUnit")}
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
              aria-invalid={Boolean(getFieldError("primarySupplierId"))}
              className={controlClass("primarySupplierId", "h-11 bg-white")}
            >
              <option value="">未設定</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            {fieldError("primarySupplierId")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            発注先側の商品コード
            <input
              name="supplierProductCode"
              defaultValue={valueOrEmpty(product.supplierProductCode)}
              maxLength={100}
              aria-invalid={Boolean(getFieldError("supplierProductCode"))}
              className={controlClass("supplierProductCode", "h-11")}
            />
            {fieldError("supplierProductCode")}
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
              aria-invalid={Boolean(getFieldError("standardPrice"))}
              className={controlClass("standardPrice", "h-11 text-right")}
            />
            {fieldError("standardPrice")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            標準の最低在庫
            <input
              ref={defaultMinStockInputRef}
              type="number"
              name="defaultMinStock"
              defaultValue={product.defaultMinStock}
              min="0"
              max="9999"
              required
              inputMode="numeric"
              aria-invalid={Boolean(getFieldError("defaultMinStock"))}
              className={controlClass("defaultMinStock", "h-11 text-right")}
            />
            {fieldError("defaultMinStock")}
            {product.recommendedMinStock.recommended !== null ? (
              <button
                type="button"
                onClick={() => {
                  if (defaultMinStockInputRef.current) {
                    defaultMinStockInputRef.current.value = String(product.recommendedMinStock.recommended);
                  }
                }}
                className="mt-2 justify-self-start rounded border border-accent px-3 py-2 text-xs font-semibold text-accent transition hover:bg-teal-50"
              >
                推奨 {product.recommendedMinStock.recommended} を入力
              </button>
            ) : (
              <p className="mt-2 text-xs text-muted">推奨: データ不足</p>
            )}
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
            aria-invalid={Boolean(getFieldError("notes"))}
            className={controlClass("notes", "min-h-28 py-2")}
          />
          {fieldError("notes")}
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
