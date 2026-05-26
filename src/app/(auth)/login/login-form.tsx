"use client";

import { type FormEvent, useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const defaultEmail = process.env.NODE_ENV === "production" ? "" : "test@example.com";
  const defaultPassword = process.env.NODE_ENV === "production" ? "" : "password";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/home",
      });

      if (!result || result.error) {
        setError("メールアドレスまたはパスワードが違います。");
        return;
      }

      window.location.assign(result.url ?? "/home");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
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
          required
          className="h-12 rounded border border-line bg-white px-4 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="password" className="text-sm font-semibold text-ink">
          パスワード
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          defaultValue={defaultPassword}
          required
          className="h-12 rounded border border-line bg-white px-4 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {error ? (
        <p className="rounded border border-danger/30 bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="h-12 rounded bg-accent px-5 text-base font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "ログイン中" : "ログイン"}
      </button>
    </form>
  );
}
