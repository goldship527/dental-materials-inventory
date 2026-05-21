"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupplierAction, type SupplierMasterActionState, type SupplierMasterFieldName } from "@/lib/actions/suppliers";

const initialState: SupplierMasterActionState = {};

export function SupplierCreateForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createSupplierAction, initialState);
  const getFieldError = (fieldName: SupplierMasterFieldName) => state.fieldErrors?.[fieldName];
  const controlClass = (fieldName: SupplierMasterFieldName, className = "") => {
    const hasError = Boolean(getFieldError(fieldName));

    return [
      "rounded border px-3 text-ink outline-none focus:ring-2",
      hasError ? "border-danger focus:border-danger focus:ring-danger/20" : "border-line focus:border-accent focus:ring-accent/20",
      className,
    ]
      .filter(Boolean)
      .join(" ");
  };
  const fieldError = (fieldName: SupplierMasterFieldName) => {
    const message = getFieldError(fieldName);

    return message ? <p className="text-xs font-semibold text-danger">{message}</p> : null;
  };

  useEffect(() => {
    if (state.status === "success" && state.supplierId) {
      router.push(`/suppliers/${state.supplierId}`);
    }
  }, [router, state.status, state.supplierId]);

  return (
    <form action={formAction} noValidate className="grid gap-6">
      <section className="rounded border border-line bg-white p-5 shadow-panel">
        <h2 className="text-lg font-semibold">基本情報</h2>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1 text-sm font-semibold text-muted">
            発注先名
            <input
              name="name"
              required
              maxLength={100}
              aria-invalid={Boolean(getFieldError("name"))}
              className={controlClass("name", "h-11 text-base font-semibold")}
            />
            {fieldError("name")}
          </label>
        </div>
      </section>

      <section className="rounded border border-line bg-white p-5 shadow-panel">
        <h2 className="text-lg font-semibold">連絡先</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-muted md:col-span-2">
            住所
            <input name="address" maxLength={300} aria-invalid={Boolean(getFieldError("address"))} className={controlClass("address", "h-11")} />
            {fieldError("address")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            電話
            <input name="phone" maxLength={100} aria-invalid={Boolean(getFieldError("phone"))} className={controlClass("phone", "h-11")} />
            {fieldError("phone")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            FAX
            <input name="fax" maxLength={100} aria-invalid={Boolean(getFieldError("fax"))} className={controlClass("fax", "h-11")} />
            {fieldError("fax")}
          </label>

          <label className="grid gap-1 text-sm font-semibold text-muted">
            メール
            <input
              type="email"
              name="email"
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
              maxLength={254}
              aria-invalid={Boolean(getFieldError("contactPersonEmail"))}
              className={controlClass("contactPersonEmail", "h-11")}
            />
            {fieldError("contactPersonEmail")}
          </label>
        </div>
      </section>

      <section className="rounded border border-line bg-white p-5 shadow-panel">
        <label className="grid gap-1 text-sm font-semibold text-muted">
          備考
          <textarea name="notes" maxLength={1000} aria-invalid={Boolean(getFieldError("notes"))} className={controlClass("notes", "min-h-32 py-2")} />
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
          {isPending ? "作成中" : "発注先を作成"}
        </button>
        <a
          className="rounded border border-line bg-white px-5 py-3 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
          href="/suppliers"
        >
          発注先マスタへ戻る
        </a>
      </div>
    </form>
  );
}
