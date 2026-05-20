"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createProductAction, type CreateProductInput, type ProductMasterActionState } from "@/lib/actions/products";
import type { ProductSupplierOption } from "@/lib/db/products";

type ProductCreateFormProps = {
  suppliers: ProductSupplierOption[];
};

type ProductFieldName = keyof CreateProductInput;

const initialState: ProductMasterActionState = {};

export function ProductCreateForm({ suppliers }: ProductCreateFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createProductAction, initialState);

  const getFieldError = (fieldName: ProductFieldName) => state.fieldErrors?.[fieldName];
  const controlClass = (fieldName: ProductFieldName, className = "") => {
    const hasError = Boolean(getFieldError(fieldName));

    return [
      "rounded border px-3 text-ink outline-none focus:ring-2",
      hasError ? "border-danger focus:border-danger focus:ring-danger/20" : "border-line focus:border-accent focus:ring-accent/20",
      className,
    ]
      .filter(Boolean)
      .join(" ");
  };
  const fieldError = (fieldName: ProductFieldName) => {
    const message = getFieldError(fieldName);

    return message ? <p className="text-xs font-semibold text-danger">{message}</p> : null;
  };

  useEffect(() => {
    if (state.status === "success" && state.productId) {
      router.push(`/products/${state.productId}`);
    }
  }, [router, state.productId, state.status]);

  return (
    <form action={formAction} noValidate className="grid gap-6">
      <section className="rounded border border-line bg-white p-5 shadow-panel">
        <h2 className="text-lg font-semibold">基本情報</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-muted md:col-span-2">
            商品名
            <input
              name="name"
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
              maxLength={64}
              aria-invalid={Boolean(getFieldError("productCode"))}
              className={controlClass("productCode", "h-11")}
            />
            {fieldError("productCode")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            JANコード
            <input
              name="janCode"
              inputMode="numeric"
              maxLength={13}
              pattern="\d{13}"
              aria-invalid={Boolean(getFieldError("janCode"))}
              className={controlClass("janCode", "h-11 font-mono")}
            />
            {fieldError("janCode")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            内部コード
            <input
              name="internalCode"
              maxLength={64}
              aria-invalid={Boolean(getFieldError("internalCode"))}
              className={controlClass("internalCode", "h-11")}
            />
            {fieldError("internalCode")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            カテゴリ
            <input
              name="category"
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
              maxLength={100}
              aria-invalid={Boolean(getFieldError("specification"))}
              className={controlClass("specification", "h-11")}
            />
            {fieldError("specification")}
          </label>
        </div>
      </section>

      <section className="rounded border border-line bg-white p-5 shadow-panel">
        <h2 className="text-lg font-semibold">発注・在庫判断</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-muted">
            発注単位
            <input
              name="orderUnit"
              maxLength={100}
              aria-invalid={Boolean(getFieldError("orderUnit"))}
              className={controlClass("orderUnit", "h-11")}
            />
            {fieldError("orderUnit")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            主発注先
            <select
              name="primarySupplierId"
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
            発注先の商品コード
            <input
              name="supplierProductCode"
              maxLength={64}
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
              min="0"
              max="9999999"
              step="0.01"
              inputMode="decimal"
              aria-invalid={Boolean(getFieldError("standardPrice"))}
              className={controlClass("standardPrice", "h-11 text-right")}
            />
            {fieldError("standardPrice")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            標準の最低在庫
            <input
              type="number"
              name="defaultMinStock"
              defaultValue="0"
              min="0"
              max="9999"
              required
              inputMode="numeric"
              aria-invalid={Boolean(getFieldError("defaultMinStock"))}
              className={controlClass("defaultMinStock", "h-11 text-right")}
            />
            {fieldError("defaultMinStock")}
          </label>
        </div>
        <p className="mt-3 text-xs text-muted">
          この画面では在庫行を作成しません。作成直後の商品は在庫一覧には表示されません。
        </p>
      </section>

      <section className="rounded border border-line bg-white p-5 shadow-panel">
        <label className="grid gap-1 text-sm font-semibold text-muted">
          備考
          <textarea
            name="notes"
            maxLength={1000}
            aria-invalid={Boolean(getFieldError("notes"))}
            className={controlClass("notes", "min-h-32 py-2")}
          />
          {fieldError("notes")}
        </label>
        <p className="mt-3 text-xs text-muted">
          患者情報、実在クリニック名、会社の秘密情報、APIキーやパスワードは入力しないでください。
        </p>
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
          {isPending ? "作成中" : "商品を作成"}
        </button>
        <a
          className="rounded border border-line bg-white px-5 py-3 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
          href="/products"
        >
          商品マスタ一覧へ戻る
        </a>
      </div>
    </form>
  );
}
