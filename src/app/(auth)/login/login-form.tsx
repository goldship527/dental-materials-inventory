"use client";

import { useFormStatus } from "react-dom";
import { loginAction } from "@/lib/actions/session";

type LoginFormProps = {
  errorMessage?: string;
};

type LoginFieldsProps = {
  defaultEmail: string;
  defaultPassword: string;
  errorMessage?: string;
};

function LoginFields({ defaultEmail, defaultPassword, errorMessage }: LoginFieldsProps) {
  const { pending } = useFormStatus();

  return (
    <>
      <div className="grid gap-2">
        <label htmlFor="email" className="text-sm font-semibold text-ink">
          メールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          disabled={pending}
          required
          className="h-12 rounded border border-line bg-white px-4 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-wait disabled:bg-gray-50 disabled:text-muted"
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="password" className="text-sm font-semibold text-ink">
          パスワード
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          defaultValue={defaultPassword}
          disabled={pending}
          required
          className="h-12 rounded border border-line bg-white px-4 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-wait disabled:bg-gray-50 disabled:text-muted"
        />
      </div>

      {errorMessage ? (
        <p className="rounded border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}

      {pending ? (
        <p className="rounded border border-accent/20 bg-teal-50 px-4 py-3 text-sm font-semibold text-accent" aria-live="polite">
          ログイン中です。少しお待ちください。
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex h-12 items-center justify-center rounded bg-accent px-5 text-base font-semibold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? (
          <span
            className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            aria-hidden="true"
          />
        ) : null}
        {pending ? "ログイン中..." : "ログイン"}
      </button>
    </>
  );
}

export function LoginForm({ errorMessage }: LoginFormProps) {
  const defaultEmail = process.env.NODE_ENV === "production" ? "" : "test@example.com";
  const defaultPassword = process.env.NODE_ENV === "production" ? "" : "password";

  return (
    <form action={loginAction} className="grid gap-5">
      <LoginFields defaultEmail={defaultEmail} defaultPassword={defaultPassword} errorMessage={errorMessage} />
    </form>
  );
}
