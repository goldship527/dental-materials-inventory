"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import { changePasswordAction, type AccountActionState } from "@/lib/actions/account";

const initialState: AccountActionState = {};

export function PasswordForm() {
  const [state, formAction, isPending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="grid gap-5 rounded border border-line bg-white p-5 shadow-panel">
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-muted" htmlFor="currentPassword">
          現在のパスワード
        </label>
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          required
          className="h-12 rounded border border-line px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold text-muted" htmlFor="newPassword">
          新しいパスワード
        </label>
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          required
          minLength={8}
          pattern="[\x21-\x7E]+"
          className="h-12 rounded border border-line px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <p className="text-xs text-muted">8文字以上。半角英数字と記号が使えます。</p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-semibold text-muted" htmlFor="confirmPassword">
          新しいパスワード（確認）
        </label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={8}
          pattern="[\x21-\x7E]+"
          className="h-12 rounded border border-line px-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {state.message ? (
        <div
          className={
            state.status === "success"
              ? "rounded border border-accent/20 bg-emerald-50 px-4 py-3 text-sm text-accent"
              : "rounded border border-danger/20 bg-red-50 px-4 py-3 text-sm text-danger"
          }
        >
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="h-12 rounded bg-accent px-5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "変更中" : "パスワードを変更"}
      </button>
    </form>
  );
}
