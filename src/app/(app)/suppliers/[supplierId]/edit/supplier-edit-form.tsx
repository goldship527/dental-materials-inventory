"use client";

import { useActionState } from "react";
import {
  updateSupplierMasterWithStateAction,
  type SupplierMasterActionState,
  type SupplierMasterFieldName,
} from "@/lib/actions/suppliers";
import type { SupplierDetail } from "@/lib/db/suppliers";

type SupplierEditFormProps = {
  supplier: SupplierDetail;
};

const initialState: SupplierMasterActionState = {};

export function SupplierEditForm({ supplier }: SupplierEditFormProps) {
  const [state, formAction, isPending] = useActionState(updateSupplierMasterWithStateAction, initialState);
  const plannedOrderRequestCount = supplier.orderRequestCounts.DRAFT + supplier.orderRequestCounts.CONFIRMED;
  const getFieldError = (fieldName: SupplierMasterFieldName) => state.fieldErrors?.[fieldName];
  const controlClass = (fieldName: SupplierMasterFieldName, className = "") => {
    const hasError = Boolean(getFieldError(fieldName));

    return [
      "rounded border px-3 text-ink  ",
      hasError ? "border-danger  " : "border-line  ",
      className,
    ]
      .filter(Boolean)
      .join(" ");
  };
  const fieldError = (fieldName: SupplierMasterFieldName) => {
    const message = getFieldError(fieldName);

    return message ? <p className="text-xs font-semibold text-danger">{message}</p> : null;
  };

  return (
    <form action={formAction} noValidate className="grid gap-6">
      <input type="hidden" name="supplierId" value={supplier.id} />

      <section className="rounded border border-line bg-panel p-5 shadow-sheet">
        <h2 className="text-lg font-semibold">基本情報</h2>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1 text-sm font-semibold text-muted">
            発注先名
            <input
              name="name"
              defaultValue={supplier.name}
              required
              maxLength={100}
              aria-invalid={Boolean(getFieldError("name"))}
              className={controlClass("name", "h-11 text-base font-semibold")}
            />
            {fieldError("name")}
          </label>
        </div>
      </section>

      <section className="rounded border border-line bg-panel p-5 shadow-sheet">
        <h2 className="text-lg font-semibold">連絡先</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-muted md:col-span-2">
            住所
            <input
              name="address"
              defaultValue={supplier.address ?? ""}
              maxLength={300}
              aria-invalid={Boolean(getFieldError("address"))}
              className={controlClass("address", "h-11")}
            />
            {fieldError("address")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            電話
            <input
              name="phone"
              defaultValue={supplier.phone ?? ""}
              maxLength={100}
              aria-invalid={Boolean(getFieldError("phone"))}
              className={controlClass("phone", "h-11")}
            />
            {fieldError("phone")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            FAX
            <input
              name="fax"
              defaultValue={supplier.fax ?? ""}
              maxLength={100}
              aria-invalid={Boolean(getFieldError("fax"))}
              className={controlClass("fax", "h-11")}
            />
            {fieldError("fax")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            メール
            <input
              type="email"
              name="email"
              defaultValue={supplier.email ?? ""}
              maxLength={254}
              aria-invalid={Boolean(getFieldError("email"))}
              className={controlClass("email", "h-11")}
            />
            {fieldError("email")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            担当者名
            <input
              name="contactPersonName"
              defaultValue={supplier.contactPersonName ?? ""}
              maxLength={100}
              aria-invalid={Boolean(getFieldError("contactPersonName"))}
              className={controlClass("contactPersonName", "h-11")}
            />
            {fieldError("contactPersonName")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            担当者メール
            <input
              type="email"
              name="contactPersonEmail"
              defaultValue={supplier.contactPersonEmail ?? ""}
              maxLength={254}
              aria-invalid={Boolean(getFieldError("contactPersonEmail"))}
              className={controlClass("contactPersonEmail", "h-11")}
            />
            {fieldError("contactPersonEmail")}
          </label>
        </div>
      </section>

      <section className="rounded border border-line bg-panel p-5 shadow-sheet">
        <label className="grid gap-1 text-sm font-semibold text-muted">
          備考
          <textarea
            name="notes"
            defaultValue={supplier.notes ?? ""}
            maxLength={1000}
            aria-invalid={Boolean(getFieldError("notes"))}
            className={controlClass("notes", "min-h-32 py-2")}
          />
          {fieldError("notes")}
        </label>
        <p className="mt-3 text-xs text-muted">個人情報や秘密情報は入力しないでください。</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded border border-line bg-panel p-5 shadow-sheet">
          <p className="text-sm font-semibold text-muted">取扱商品</p>
          <p className="mt-2 text-2xl font-semibold">{supplier.productCount}</p>
        </div>
        <div className="rounded border border-line bg-panel p-5 shadow-sheet">
          <p className="text-sm font-semibold text-muted">不足あり</p>
          <p className={supplier.shortageProductCount > 0 ? "mt-2 text-2xl font-semibold text-danger" : "mt-2 text-2xl font-semibold"}>
            {supplier.shortageProductCount}
          </p>
        </div>
        <div className="rounded border border-line bg-panel p-5 shadow-sheet">
          <p className="text-sm font-semibold text-muted">発注予定候補</p>
          <p className="mt-2 text-2xl font-semibold">{plannedOrderRequestCount}</p>
        </div>
      </section>

      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "rounded border border-line border-l-4 border-l-success bg-panel px-4 py-3 text-sm font-semibold text-success"
              : "rounded border border-line border-l-4 border-l-danger bg-panel px-4 py-3 text-sm font-semibold text-danger"
          }
        >
          {state.status === "success" ? "✓ " : state.message.startsWith("エラー") ? "" : "エラー: "}{state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded btn-primary px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
        >
          {isPending ? "保存中" : "保存する"}
        </button>
        <a
          className="rounded btn-secondary px-5 py-3 text-sm font-semibold transition"
          href={`/suppliers/${supplier.id}`}
        >
          詳細へ戻る
        </a>
      </div>
    </form>
  );
}
